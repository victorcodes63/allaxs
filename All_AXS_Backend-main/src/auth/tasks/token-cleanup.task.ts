import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenService } from '../services/refresh-token.service';

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly refreshTokenService: RefreshTokenService) {}

  /**
   * Run every day at 3 AM to clean up expired tokens
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTokenCleanup() {
    this.logger.log('Running token cleanup task...');

    try {
      const deletedCount = await this.refreshTokenService.deleteExpiredTokens();
      this.logger.log(`Cleaned up ${deletedCount} expired refresh tokens`);
    } catch (error) {
      this.logger.error('Failed to clean up expired tokens', error);
    }
  }

  /**
   * Manual trigger for testing or immediate cleanup
   */
  async triggerCleanup(): Promise<number> {
    this.logger.log('Manual token cleanup triggered');
    return this.refreshTokenService.deleteExpiredTokens();
  }
}
