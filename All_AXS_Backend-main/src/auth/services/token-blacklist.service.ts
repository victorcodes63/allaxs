import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { BlacklistedToken } from '../entities/blacklisted-token.entity';

@Injectable()
export class TokenBlacklistService {
  constructor(
    @InjectRepository(BlacklistedToken)
    private readonly blacklistedTokenRepository: Repository<BlacklistedToken>,
  ) {}

  /**
   * Add a token to the blacklist
   */
  async blacklistToken(
    token: string,
    expiresAt: Date,
    reason?: string,
    userId?: string,
  ): Promise<void> {
    const blacklistedToken = this.blacklistedTokenRepository.create({
      token,
      expiresAt,
      reason,
      userId,
    });

    await this.blacklistedTokenRepository.save(blacklistedToken);
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistedToken = await this.blacklistedTokenRepository.findOne({
      where: { token },
    });

    return !!blacklistedToken;
  }

  /**
   * Blacklist all tokens for a user (useful on password change)
   */
  async blacklistUserTokens(
    userId: string,
    tokens: string[],
    reason: string,
  ): Promise<void> {
    const blacklistedTokens = tokens.map((token) =>
      this.blacklistedTokenRepository.create({
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes (access token expiry)
        reason,
        userId,
      }),
    );

    await this.blacklistedTokenRepository.save(blacklistedTokens);
  }

  /**
   * Clean up expired blacklisted tokens
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.blacklistedTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }
}
