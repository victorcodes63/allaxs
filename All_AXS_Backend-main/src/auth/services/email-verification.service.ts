import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailVerification } from '../entities/email-verification.entity';
import { User } from '../../users/entities/user.entity';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a cryptographically secure random token (64 chars)
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and send a verification email for a user
   */
  async createAndSendVerificationEmail(user: User): Promise<EmailVerification> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate any existing verification tokens for this user
    await this.emailVerificationRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true, usedAt: new Date() },
    );

    const verification = this.emailVerificationRepository.create({
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
      isUsed: false,
    });

    const savedVerification =
      await this.emailVerificationRepository.save(verification);

    // Send email
    await this.emailService.sendVerificationEmail(user, token);

    return savedVerification;
  }

  /**
   * Verify an email using a token
   */
  async verifyEmail(token: string): Promise<User> {
    const verification = await this.emailVerificationRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('Invalid verification token');
    }

    if (verification.isUsed) {
      throw new BadRequestException('Verification token has already been used');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark as used
    verification.isUsed = true;
    verification.usedAt = new Date();
    await this.emailVerificationRepository.save(verification);

    return verification.user;
  }

  /**
   * Find an existing unused verification token for a user
   */
  async findUnusedTokenForUser(
    userId: string,
  ): Promise<EmailVerification | null> {
    return this.emailVerificationRepository.findOne({
      where: {
        userId,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if a user has verified their email (has at least one used token)
   */
  async isUserVerified(userId: string): Promise<boolean> {
    const usedVerification = await this.emailVerificationRepository.findOne({
      where: {
        userId,
        isUsed: true,
      },
    });
    return !!usedVerification;
  }
}
