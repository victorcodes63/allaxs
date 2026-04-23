import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface TokenMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Generate a cryptographically secure random token (128 chars)
   */
  generateToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create and store a new refresh token session
   * Returns both the session entity and the plain token string
   */
  async createRefreshToken(
    userId: string,
    expiresIn: number = 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    metadata?: TokenMetadata,
  ): Promise<{ session: RefreshToken; token: string }> {
    const token = this.generateToken();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + expiresIn);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceId: metadata?.deviceId,
    });

    const session = await this.refreshTokenRepository.save(refreshToken);

    return { session, token };
  }

  /**
   * Find a refresh token session by ID (sid from JWT)
   */
  async findById(sessionId: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { id: sessionId },
      relations: ['user'],
    });
  }

  /**
   * Validate a refresh token against a session
   */
  async validateRefreshToken(
    sessionId: string,
    token: string,
  ): Promise<RefreshToken> {
    const session = await this.findById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token hash matches
    const isValid = await bcrypt.compare(token, session.tokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if already used (rotation attack detection)
    if (session.usedAt) {
      // Potential reuse attack - revoke all user sessions
      await this.revokeAllUserTokens(
        session.userId,
        'Refresh token reuse detected - potential security breach',
      );
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been revoked for security.',
      );
    }

    // Check if revoked
    if (session.isRevoked || session.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    return session;
  }

  /**
   * Mark a session as used (for rotation)
   */
  async markSessionAsUsed(sessionId: string): Promise<void> {
    await this.refreshTokenRepository.update(sessionId, {
      usedAt: new Date(),
    });
  }

  /**
   * Revoke a session by ID
   */
  async revokeSession(
    sessionId: string,
    reason?: string,
    replacedByToken?: string,
  ): Promise<void> {
    await this.refreshTokenRepository.update(sessionId, {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
      replacedByToken,
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string, reason?: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        userId,
        isRevoked: false,
      },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'User requested logout from all devices',
      },
    );
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Get all active refresh tokens for a user
   */
  async getUserActiveTokens(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
