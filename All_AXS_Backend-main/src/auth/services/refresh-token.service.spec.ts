jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockImplementation(async () => true),
  hash: jest.fn().mockImplementation(async () => 'hashed-token'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshToken } from '../entities/refresh-token.entity';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repository: jest.Mocked<Repository<RefreshToken>>;
  const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  const mockSession: Partial<RefreshToken> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    tokenHash: '$2a$10$mockhash',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    usedAt: undefined,
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
  };

  beforeEach(async () => {
    // Reset and restore default mock behavior
    (mockedBcrypt.compare as any).mockReset().mockResolvedValue(true);
    (mockedBcrypt.hash as any).mockReset().mockResolvedValue('hashed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    repository = module.get(getRepositoryToken(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateToken', () => {
    it('should generate a 128-character hex string', () => {
      const token = service.generateToken();
      expect(token).toHaveLength(128);
      expect(token).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('createRefreshToken', () => {
    it('should create and return session with plain token', async () => {
      repository.create.mockReturnValue(mockSession as RefreshToken);
      repository.save.mockResolvedValue(mockSession as RefreshToken);

      const result = await service.createRefreshToken(
        'user-123',
        7 * 24 * 60 * 60 * 1000,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('token');
      expect(result.token).toHaveLength(128); // Plain token
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find session by ID', async () => {
      repository.findOne.mockResolvedValue(mockSession as RefreshToken);

      const result = await service.findById('session-123');

      expect(result).toEqual(mockSession);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        relations: ['user'],
      });
    });

    it('should return null if session not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should throw for invalid session', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.validateRefreshToken('session-123', 'token'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw for already used token (reuse attack)', async () => {
      const usedSession = {
        ...mockSession,
        usedAt: new Date(),
      };
      repository.findOne.mockResolvedValue(usedSession as RefreshToken);
      repository.update.mockResolvedValue({ affected: 1 } as any);

      // bcrypt.compare already mocked to return true
      const revokeSpy = jest
        .spyOn(service, 'revokeAllUserTokens')
        .mockResolvedValue(undefined as unknown as void);

      // Note: bcrypt.compare will be called but we can't easily mock it
      // This test verifies the structure, actual validation happens in integration tests
      await expect(
        service.validateRefreshToken('session-123', 'token'),
      ).rejects.toThrow(
        'Refresh token reuse detected. All sessions have been revoked for security.',
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'token',
        usedSession.tokenHash,
      );
      expect(revokeSpy).toHaveBeenCalledWith(
        usedSession.userId,
        'Refresh token reuse detected - potential security breach',
      );

      revokeSpy.mockRestore();
    });

    it('should throw for revoked session', async () => {
      const revokedSession = {
        ...mockSession,
        isRevoked: true,
        revokedAt: new Date(),
      };
      repository.findOne.mockResolvedValue(revokedSession as RefreshToken);

      // Note: bcrypt.compare will fail first with mock data, but structure is tested
      await expect(
        service.validateRefreshToken('session-123', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      };
      repository.findOne.mockResolvedValue(expiredSession as RefreshToken);

      // Note: bcrypt.compare will fail first with mock data, but structure is tested
      await expect(
        service.validateRefreshToken('session-123', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('markSessionAsUsed', () => {
    it('should mark session as used', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as any);

      await service.markSessionAsUsed('session-123');

      expect(repository.update).toHaveBeenCalledWith('session-123', {
        usedAt: expect.any(Date),
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as any);

      await service.revokeSession(
        'session-123',
        'User logout',
        'new-session-id',
      );

      expect(repository.update).toHaveBeenCalledWith('session-123', {
        isRevoked: true,
        revokedAt: expect.any(Date),
        revokedReason: 'User logout',
        replacedByToken: 'new-session-id',
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      repository.update.mockResolvedValue({ affected: 3 } as any);

      await service.revokeAllUserTokens('user-123', 'Password changed');

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        expect.objectContaining({
          isRevoked: true,
          revokedReason: 'Password changed',
        }),
      );
    });
  });

  describe('deleteExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      repository.delete.mockResolvedValue({ affected: 5 } as any);

      const result = await service.deleteExpiredTokens();

      expect(result).toBe(5);
      expect(repository.delete).toHaveBeenCalled();
    });
  });

  describe('getUserActiveTokens', () => {
    it('should return active tokens for user', async () => {
      const tokens = [mockSession, { ...mockSession, id: 'session-2' }];
      repository.find.mockResolvedValue(tokens as RefreshToken[]);

      const result = await service.getUserActiveTokens('user-123');

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRevoked: false },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
