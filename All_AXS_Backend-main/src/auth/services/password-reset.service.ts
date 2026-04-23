import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordReset } from '../entities/password-reset.entity';
import { User } from '../../users/entities/user.entity';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a cryptographically secure random token (64 chars)
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and send a password reset email for a user
   */
  async createAndSendPasswordResetEmail(
    user: User,
    ipAddress?: string,
  ): Promise<PasswordReset> {
    this.logger.log(
      `Creating password reset token for userId: ${user.id}, email: ${user.email}`,
    );

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing unused reset tokens for this user
    await this.passwordResetRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true, usedAt: new Date() },
    );

    const passwordReset = this.passwordResetRepository.create({
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
      isUsed: false,
      ipAddress,
    });

    const savedPasswordReset =
      await this.passwordResetRepository.save(passwordReset);

    this.logger.log(
      `Password reset token created for userId: ${user.id}. Token expires at: ${expiresAt.toISOString()}`,
    );

    // Send email
    this.logger.log(
      `Attempting to send password reset email to: ${user.email}`,
    );
    await this.emailService.sendPasswordResetEmail(user, token);

    return savedPasswordReset;
  }

  /**
   * Verify a password reset token
   */
  async verifyResetToken(token: string): Promise<PasswordReset> {
    const passwordReset = await this.passwordResetRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!passwordReset) {
      throw new NotFoundException('Invalid password reset token');
    }

    if (passwordReset.isUsed) {
      throw new BadRequestException(
        'Password reset token has already been used',
      );
    }

    if (new Date() > passwordReset.expiresAt) {
      throw new BadRequestException('Password reset token has expired');
    }

    return passwordReset;
  }

  /**
   * Mark a password reset token as used
   */
  async markTokenAsUsed(token: string): Promise<void> {
    const passwordReset = await this.passwordResetRepository.findOne({
      where: { token },
    });

    if (passwordReset) {
      passwordReset.isUsed = true;
      passwordReset.usedAt = new Date();
      await this.passwordResetRepository.save(passwordReset);
    }
  }
}
