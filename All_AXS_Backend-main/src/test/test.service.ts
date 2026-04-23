import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailVerification } from '../auth/entities/email-verification.entity';
import { PasswordReset } from '../auth/entities/password-reset.entity';
import { Role } from '../domain/enums';
import * as bcrypt from 'bcryptjs';

export interface SeedUserDto {
  email: string;
  password: string;
  name?: string;
  roles?: Role[] | string[]; // Accept both enum and string array
  verified?: boolean;
}

@Injectable()
export class TestService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
  ) {}

  /**
   * Upsert a user for testing purposes
   */
  async seedUser(dto: SeedUserDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Update existing user
      existingUser.passwordHash = passwordHash;
      existingUser.name = dto.name || existingUser.name;
      // Convert string array to Role enum array if needed
      const roles = dto.roles
        ? (dto.roles as string[]).map((r) => r as Role)
        : existingUser.roles;
      existingUser.roles = roles;
      await this.userRepository.save(existingUser);

      // Mark email as verified if requested
      if (dto.verified) {
        await this.markEmailAsVerified(existingUser.id);
      }

      return existingUser;
    }

    // Create new user
    // Convert string array to Role enum array if needed
    const roles = dto.roles
      ? (dto.roles as string[]).map((r) => r as Role)
      : [Role.ATTENDEE];
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name || 'Test User',
      roles,
    });

    const savedUser = await this.userRepository.save(user);

    // Mark email as verified if requested
    if (dto.verified) {
      await this.markEmailAsVerified(savedUser.id);
    }

    return savedUser;
  }

  /**
   * Mark a user's email as verified by creating a used verification record
   */
  private async markEmailAsVerified(userId: string): Promise<void> {
    // Check if already verified
    const existing = await this.emailVerificationRepository.findOne({
      where: { userId, isUsed: true },
    });

    if (existing) {
      return; // Already verified
    }

    // Create a verification record marked as used
    const verification = this.emailVerificationRepository.create({
      userId,
      email: (await this.userRepository.findOne({ where: { id: userId } }))!
        .email,
      token: `verified-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isUsed: true,
      usedAt: new Date(),
    });

    await this.emailVerificationRepository.save(verification);
  }

  /**
   * Get the latest unexpired tokens for a user
   */
  async getLatestTokens(email: string): Promise<{
    resetToken: string | null;
    verifyToken: string | null;
  }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { resetToken: null, verifyToken: null };
    }

    // Get latest unexpired, unused password reset token
    const resetToken = await this.passwordResetRepository.findOne({
      where: {
        userId: user.id,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    // Get latest unexpired, unused email verification token
    const verifyToken = await this.emailVerificationRepository.findOne({
      where: {
        userId: user.id,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      resetToken:
        resetToken && new Date() < resetToken.expiresAt
          ? resetToken.token
          : null,
      verifyToken:
        verifyToken && new Date() < verifyToken.expiresAt
          ? verifyToken.token
          : null,
    };
  }
}
