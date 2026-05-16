import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { Role, UserStatus } from '../domain/enums';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  RefreshTokenService,
  TokenMetadata,
} from './services/refresh-token.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailService } from './services/email.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    roles: Role[];
  };
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailService: EmailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(
    dto: RegisterDto,
    metadata?: TokenMetadata,
  ): Promise<AuthResponse> {
    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user (UsersService handles uniqueness check)
    const user = await this.usersService.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
      roles: [Role.ATTENDEE],
    });

    // Create and send verification email
    try {
      await this.emailVerificationService.createAndSendVerificationEmail(user);
    } catch (error) {
      // Log error but don't fail registration if email fails
      // The user can request a resend later
      console.error('Failed to send verification email:', error);
    }

    // Issue tokens with device fingerprint
    const tokens = await this.issueTokensForUser(user, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles,
      },
      tokens,
    };
  }

  /**
   * Demo / dev: grant ORGANIZER role and return fresh tokens so JWT claims stay in sync.
   * In production, set ENABLE_PROMOTE_ORGANIZER_ROLE=true to allow.
   */
  async promoteOrganizerDemo(
    userId: string,
    metadata?: TokenMetadata,
  ): Promise<AuthResponse> {
    const allow =
      this.configService.get<string>('NODE_ENV') !== 'production' ||
      this.configService.get<string>('ENABLE_PROMOTE_ORGANIZER_ROLE') === 'true';
    if (!allow) {
      throw new ForbiddenException(
        'Organizer self-promotion is disabled. Set ENABLE_PROMOTE_ORGANIZER_ROLE=true to enable in production.',
      );
    }

    const existing = await this.usersService.findByIdOrFail(userId);
    if (existing.roles?.includes(Role.ADMIN)) {
      throw new ForbiddenException(
        'Admin accounts cannot be promoted to organizer via this endpoint.',
      );
    }

    await this.usersService.addOrganizerRole(userId);
    const user = await this.usersService.findByIdOrFail(userId);
    const tokens = await this.issueTokensForUser(user, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles,
      },
      tokens,
    };
  }

  async login(dto: LoginDto, metadata?: TokenMetadata): Promise<AuthResponse> {
    // Find user
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Block suspended accounts at the credential gate so we never mint
    // tokens for them in the first place. The error carries a stable
    // `accountSuspended` code that the frontend uses to render a
    // dedicated "contact support" message.
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: 'Account suspended. Please contact support.',
        code: 'accountSuspended',
      });
    }

    // Issue tokens with device fingerprint
    const tokens = await this.issueTokensForUser(user, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles,
      },
      tokens,
    };
  }

  async signInWithGoogle(
    credential: string,
    metadata?: TokenMetadata,
  ): Promise<AuthResponse> {
    const { email, name } = await this.verifyGoogleIdToken(credential);
    const user = await this.usersService.upsertGoogleOAuthUser({ email, name });
    const tokens = await this.issueTokensForUser(user, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles,
      },
      tokens,
    };
  }

  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<{ email: string; name: string }> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new BadRequestException(
        'Google sign-in is not configured (GOOGLE_CLIENT_ID).',
      );
    }
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      this.logger.warn(`Google tokeninfo fetch failed: ${String(e)}`);
      throw new UnauthorizedException('Unable to verify Google credential');
    }
    const data = (await res.json()) as Record<string, string | undefined>;
    if (!res.ok) {
      this.logger.warn(`Google tokeninfo error: ${JSON.stringify(data)}`);
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (data.aud !== clientId) {
      throw new UnauthorizedException('Google credential audience mismatch');
    }
    if (data.email_verified !== 'true') {
      throw new UnauthorizedException('Google email is not verified');
    }
    const email = (data.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Google token missing email');
    }
    const name =
      `${data.given_name ?? ''} ${data.family_name ?? ''}`.trim() ||
      (data.name ?? '').trim() ||
      email.split('@')[0] ||
      'User';
    return { email, name };
  }

  async refreshTokens(
    refreshToken: string,
    metadata?: TokenMetadata,
  ): Promise<AuthResponse> {
    // Step 1: Verify and decode the refresh token JWT
    let payload: { sub: string; sid: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Step 2: Validate payload structure
    if (payload.type !== 'refresh' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const { sub: userId, sid: sessionId } = payload;

    // Step 3: Validate the session against the database
    await this.refreshTokenService.validateRefreshToken(
      sessionId,
      refreshToken,
    );

    // Step 4: Mark the old session as used
    await this.refreshTokenService.markSessionAsUsed(sessionId);

    // Step 5: Get user
    const user = await this.usersService.findByIdOrFail(userId);

    // Step 5b: Refuse to mint new tokens for suspended accounts and
    // revoke every refresh chain they still hold. Without this a
    // suspended user could ride a previously-issued refresh token to a
    // brand new access token after the admin action.
    if (user.status !== UserStatus.ACTIVE) {
      await this.refreshTokenService.revokeAllUserTokens(
        user.id,
        'Account suspended',
      );
      throw new UnauthorizedException({
        message: 'Account suspended',
        code: 'accountSuspended',
      });
    }

    // Step 6: Issue new tokens (creates new session)
    const tokens = await this.issueTokensForUser(user, metadata);

    // Step 7: Extract new session ID from refresh token for replacement chain
    const newRefreshTokenPayload = (await this.jwtService.verifyAsync(
      tokens.refreshToken,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      },
    )) as { sid: string; sub: string; type: string } | null;
    const newSessionId = newRefreshTokenPayload?.sid;

    // Step 8: Record the replacement chain
    await this.refreshTokenService.revokeSession(
      sessionId,
      'Token rotated',
      newSessionId,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles,
      },
      tokens,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Decode to get session ID
      try {
        const payload = (await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        })) as { sid?: string } | null;
        if (payload?.sid) {
          await this.refreshTokenService.revokeSession(
            payload.sid,
            'User logout',
          );
        }
      } catch {
        // Token invalid or expired, ignore
      }
    } else {
      // If no token provided, revoke all
      await this.logoutAll(userId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllUserTokens(
      userId,
      'User logout from all devices',
    );
  }

  /**
   * Admin-driven sign-out: revoke every active refresh-token session for
   * a user and return how many sessions were terminated so we can show
   * it in the audit log and on the admin UI. Used by suspend and the
   * standalone force-logout admin action.
   */
  async forceSignOutUser(userId: string, reason: string): Promise<number> {
    const activeSessions =
      await this.refreshTokenService.getUserActiveTokens(userId);
    if (activeSessions.length === 0) return 0;
    await this.refreshTokenService.revokeAllUserTokens(userId, reason);
    return activeSessions.length;
  }

  /**
   * Issue both access and refresh tokens for a user
   * Creates a new refresh session with device fingerprint
   */
  async issueTokensForUser(
    user: User,
    context?: TokenMetadata,
  ): Promise<AuthTokens> {
    // Create refresh session
    const { session } = await this.refreshTokenService.createRefreshToken(
      user.id,
      7 * 24 * 60 * 60 * 1000, // 7 days
      context,
    );

    // Create refresh token JWT with session ID
    const refreshPayload = {
      sub: user.id,
      sid: session.id, // Session ID for lookup
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // Hash the refresh token and update session
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    session.tokenHash = tokenHash;
    await this.refreshTokenRepository.save(session);

    // Create access token
    const accessPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string): Promise<User> {
    return this.usersService.findByIdOrFail(userId);
  }

  /**
   * Request a password reset email
   * Always returns success to prevent email enumeration
   */
  async forgotPassword(
    email: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (user) {
      this.logger.log(
        `User found for password reset request. userId: ${user.id}`,
      );
      try {
        await this.passwordResetService.createAndSendPasswordResetEmail(
          user,
          ipAddress,
        );
        this.logger.log(
          `Password reset email process completed for userId: ${user.id}`,
        );
      } catch (error) {
        // Log error but don't expose it to the user
        this.logger.error(
          `Failed to send password reset email for userId: ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    } else {
      this.logger.log(
        `No user found for password reset request (email enumeration protection)`,
      );
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password using a token
   * Validates token, updates password, and revokes all existing sessions
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordReset =
      await this.passwordResetService.verifyResetToken(token);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.usersService.updatePassword(passwordReset.userId, passwordHash);

    await this.passwordResetService.markTokenAsUsed(token);

    await this.logoutAll(passwordReset.userId);

    const user =
      passwordReset.user ??
      (await this.usersService.findByIdOrFail(passwordReset.userId));
    try {
      await this.emailService.sendPasswordResetConfirmationEmail(user);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send password reset confirmation to ${user.email}: ${err.message}`,
        err.stack,
      );
    }
  }

  async validateResetPasswordToken(token: string): Promise<void> {
    await this.passwordResetService.verifyResetToken(token);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findByIdOrFail(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Password sign-in is not enabled for this account.',
      );
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, passwordHash);
    await this.logoutAll(userId);
  }

  /**
   * Resend verification email
   * Only sends if user exists and is not verified
   * Always returns success to prevent email enumeration
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (user) {
      // Check if user has verified their email
      const isVerified = await this.emailVerificationService.isUserVerified(
        user.id,
      );

      // Only send if user is not verified
      if (!isVerified) {
        try {
          // Create and send new verification email
          await this.emailVerificationService.createAndSendVerificationEmail(
            user,
          );
        } catch (error) {
          // Log error but don't expose it to the user
          console.error('Failed to send verification email:', error);
        }
      }
    }

    return {
      message:
        'If an account with that email exists and is not verified, a verification email has been sent.',
    };
  }

  /**
   * Verify email using a token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.emailVerificationService.verifyEmail(token);
    try {
      await this.emailService.sendWelcomeEmail(user);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send welcome email to ${user.email}: ${err.message}`,
        err.stack,
      );
    }
    return {
      message: 'Email verified successfully.',
    };
  }
}
