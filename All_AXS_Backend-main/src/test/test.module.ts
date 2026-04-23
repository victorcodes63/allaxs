import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { User } from '../users/entities/user.entity';
import { EmailVerification } from '../auth/entities/email-verification.entity';
import { PasswordReset } from '../auth/entities/password-reset.entity';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';

/**
 * Test module - only loaded in test environment or when ENABLE_TEST_ROUTES=true
 * Provides test-only endpoints for seeding data and fetching test tokens
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      EmailVerification,
      PasswordReset,
      AdminAuditLog,
    ]),
  ],
  controllers: [TestController],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {
  constructor() {
    // Guard: Only allow in test environment
    if (
      process.env.NODE_ENV !== 'test' &&
      process.env.ENABLE_TEST_ROUTES !== 'true'
    ) {
      throw new Error(
        'TestModule should only be loaded in test environment or when ENABLE_TEST_ROUTES=true',
      );
    }
  }
}
