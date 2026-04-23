import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenBlacklistService } from './token-blacklist.service';
import { BlacklistedToken } from '../entities/blacklisted-token.entity';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let repository: jest.Mocked<Repository<BlacklistedToken>>;

  const mockBlacklistedToken: Partial<BlacklistedToken> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    token: 'blacklisted-token',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    reason: 'User logout',
    userId: 'user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: getRepositoryToken(BlacklistedToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    repository = module.get(getRepositoryToken(BlacklistedToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', async () => {
      repository.create.mockReturnValue(
        mockBlacklistedToken as BlacklistedToken,
      );
      repository.save.mockResolvedValue(
        mockBlacklistedToken as BlacklistedToken,
      );

      await service.blacklistToken(
        'test-token',
        new Date(Date.now() + 15 * 60 * 1000),
        'User logout',
        'user-123',
      );

      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      repository.findOne.mockResolvedValue(
        mockBlacklistedToken as BlacklistedToken,
      );

      const result = await service.isTokenBlacklisted('blacklisted-token');

      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted('valid-token');

      expect(result).toBe(false);
    });
  });

  describe('blacklistUserTokens', () => {
    it('should blacklist multiple tokens for a user', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      repository.create.mockImplementation((data) => data as BlacklistedToken);
      repository.save.mockResolvedValue([] as any);

      await service.blacklistUserTokens('user-123', tokens, 'Password changed');

      expect(repository.create).toHaveBeenCalledTimes(3);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('deleteExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      repository.delete.mockResolvedValue({ affected: 10 } as any);

      const result = await service.deleteExpiredTokens();

      expect(result).toBe(10);
      expect(repository.delete).toHaveBeenCalled();
    });
  });
});
