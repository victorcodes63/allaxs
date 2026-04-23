import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../domain/enums';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let refreshTokenRepository: any;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    roles: [Role.ATTENDEE],
    status: 'ACTIVE' as any,
    orders: [],
    tickets: [],
    checkIns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: 'session-123',
    userId: mockUser.id,
    tokenHash: '$2a$10$mockhash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByIdOrFail: jest.fn(),
            createUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn(),
            validateRefreshToken: jest.fn(),
            markSessionAsUsed: jest.fn(),
            revokeSession: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            createAndSendVerificationEmail: jest.fn(),
            verifyEmail: jest.fn(),
            findUnusedTokenForUser: jest.fn(),
          },
        },
        {
          provide: PasswordResetService,
          useValue: {
            createAndSendPasswordResetEmail: jest.fn(),
            verifyResetToken: jest.fn(),
            markTokenAsUsed: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    refreshTokenService = module.get(RefreshTokenService);
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        name: 'New User',
        password: 'password123',
      };

      usersService.createUser.mockResolvedValue(mockUser as any);
      refreshTokenService.createRefreshToken.mockResolvedValue({
        session: mockSession,
        token: 'plain-token',
      } as any);
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');
      refreshTokenRepository.save.mockResolvedValue(mockSession);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(usersService.createUser).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid email', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for user without password', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const userWithoutPassword = { ...mockUser, passwordHash: undefined };
      usersService.findByEmail.mockResolvedValue(userWithoutPassword as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      const oldToken = 'old-refresh-token';
      const sessionId = 'session-123';

      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        sid: sessionId,
        type: 'refresh',
      });
      refreshTokenService.validateRefreshToken.mockResolvedValue(
        mockSession as any,
      );
      refreshTokenService.markSessionAsUsed.mockResolvedValue(undefined);
      usersService.findByIdOrFail.mockResolvedValue(mockUser as any);
      refreshTokenService.createRefreshToken.mockResolvedValue({
        session: { ...mockSession, id: 'new-session' },
        token: 'new-token',
      } as any);
      jwtService.signAsync.mockResolvedValue('new-jwt-token');
      refreshTokenRepository.save.mockResolvedValue({});
      refreshTokenService.revokeSession.mockResolvedValue(undefined);

      const result = await service.refreshTokens(oldToken);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(
        sessionId,
        oldToken,
      );
      expect(refreshTokenService.markSessionAsUsed).toHaveBeenCalledWith(
        sessionId,
      );
    });

    it('should throw for invalid refresh token JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid'));

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for invalid payload format', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        // Missing sid
        type: 'refresh',
      });

      await expect(service.refreshTokens('token')).rejects.toThrow(
        'Invalid refresh token format',
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      const refreshToken = 'token-to-revoke';
      const userId = 'user-123';

      jwtService.verifyAsync.mockResolvedValue({
        sid: 'session-123',
      });

      await service.logout(userId, refreshToken);

      expect(refreshTokenService.revokeSession).toHaveBeenCalledWith(
        'session-123',
        'User logout',
      );
    });

    it('should call logoutAll if no refresh token provided', async () => {
      const userId = 'user-123';

      await service.logout(userId);

      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        userId,
        'User logout from all devices',
      );
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user tokens', async () => {
      const userId = mockUser.id;

      await service.logoutAll(userId);

      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        userId,
        'User logout from all devices',
      );
    });
  });

  describe('validateUser', () => {
    it('should return user for valid userId', async () => {
      usersService.findByIdOrFail.mockResolvedValue(mockUser as any);

      const result = await service.validateUser(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('issueTokensForUser', () => {
    it('should issue both access and refresh tokens', async () => {
      refreshTokenService.createRefreshToken.mockResolvedValue({
        session: mockSession,
        token: 'plain-token',
      } as any);
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');
      refreshTokenRepository.save.mockResolvedValue(mockSession);

      const result = await service.issueTokensForUser(mockUser as any);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(refreshTokenService.createRefreshToken).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // access + refresh
    });
  });
});
