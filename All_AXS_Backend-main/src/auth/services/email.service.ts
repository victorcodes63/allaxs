import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly emailProvider: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string | undefined;
  private readonly frontendUrl: string | undefined;
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.emailProvider = this.configService
      .get<string>('EMAIL_PROVIDER', 'resend')
      .toLowerCase();
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resendFrom = this.configService.get<string>('RESEND_FROM');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL');
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV', 'development') ===
      'development';

    // Validate configuration
    if (this.emailProvider === 'resend') {
      if (!this.resendApiKey) {
        this.logger.error(
          'RESEND_API_KEY is not configured. Password reset and verification emails cannot be sent.',
        );
      } else {
        this.logger.log('RESEND_API_KEY detected for Resend email provider.');
        this.resend = new Resend(this.resendApiKey);
        this.logger.log('Resend email provider initialized');
      }

      if (!this.resendFrom) {
        this.logger.error(
          'RESEND_FROM is not configured. Password reset and verification emails cannot be sent.',
        );
      } else {
        this.logger.log(`Resend FROM address configured: ${this.resendFrom}`);
      }
    } else {
      this.logger.warn(
        `Unsupported EMAIL_PROVIDER: ${this.emailProvider}. Email sending is disabled.`,
      );
    }

    if (!this.frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL is not configured. Email links may be incorrect.',
      );
    }
  }

  async sendVerificationEmail(user: User, token: string): Promise<void> {
    this.logger.log(
      `[sendVerificationEmail] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    // Validate configuration (same checks as password reset)
    if (this.emailProvider !== 'resend') {
      const errorMsg = `Email provider '${this.emailProvider}' is not supported. Only 'resend' is currently supported.`;
      this.logger.error(`[sendVerificationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendVerificationEmail] In development mode, email sending is disabled due to unsupported provider.`,
        );
      }
      return;
    }

    if (!this.resendApiKey || !this.resendFrom) {
      const errorMsg =
        'RESEND_API_KEY or RESEND_FROM is not configured. Verification emails cannot be sent.';
      this.logger.error(`[sendVerificationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendVerificationEmail] In development mode, email sending is disabled due to missing configuration.`,
        );
      }
      return;
    }

    if (!this.frontendUrl) {
      this.logger.warn(
        `[sendVerificationEmail] FRONTEND_URL is not configured. Email verification link may be incorrect.`,
      );
    }

    // TODO: Frontend /verify-email page is not yet implemented
    const verificationUrl = `${this.frontendUrl || 'http://localhost:3000'}/verify-email?token=${token}`;
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${appName}${user.name ? `, ${user.name}` : ''}!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p><small>This link will expire in 24 hours.</small></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you didn't create an account with ${appName}, please ignore this email.
        </p>
      </div>
    `;

    // In development, optionally log email content instead of sending
    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[sendVerificationEmail] DEVELOPMENT MODE - Email would be sent to: ${user.email}`,
      );
      this.logger.warn(
        `[sendVerificationEmail] DEVELOPMENT MODE - Verification URL: ${verificationUrl}`,
      );
      this.logger.warn(
        `[sendVerificationEmail] DEVELOPMENT MODE - Subject: Verify your ${appName} account`,
      );
      return;
    }

    this.logger.log(
      `[sendVerificationEmail] Attempting to send verification email to: ${user.email}`,
    );

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: user.email,
        subject: `Verify your ${appName} account`,
        html,
      });

      const resendId =
        result && typeof result === 'object' && 'id' in result
          ? String((result as { id: unknown }).id)
          : 'N/A';
      const serializedResponse = (() => {
        try {
          return JSON.stringify(result);
        } catch {
          return '[unserializable response]';
        }
      })();
      this.logger.log(
        `[sendVerificationEmail] Verification email sent successfully to: ${user.email}. Resend ID: ${resendId}. Response: ${serializedResponse}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendVerificationEmail] Error sending verification email to ${user.email}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    this.logger.log(
      `[sendPasswordResetEmail] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    // Validate configuration
    if (this.emailProvider !== 'resend') {
      const errorMsg = `Email provider '${this.emailProvider}' is not supported. Only 'resend' is currently supported.`;
      this.logger.error(`[sendPasswordResetEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetEmail] In development mode, email sending is disabled due to unsupported provider.`,
        );
      }
      // Don't throw - let the endpoint return generic success
      return;
    }

    if (!this.resendApiKey) {
      const errorMsg =
        'RESEND_API_KEY is not configured. Password reset emails cannot be sent.';
      this.logger.error(`[sendPasswordResetEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetEmail] In development mode, email sending is disabled due to missing RESEND_API_KEY.`,
        );
      }
      return;
    }

    if (!this.resendFrom) {
      const errorMsg =
        'RESEND_FROM is not configured. Password reset emails cannot be sent.';
      this.logger.error(`[sendPasswordResetEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetEmail] In development mode, email sending is disabled due to missing RESEND_FROM.`,
        );
      }
      return;
    }

    if (!this.frontendUrl) {
      this.logger.warn(
        `[sendPasswordResetEmail] FRONTEND_URL is not configured. Email reset link may be incorrect.`,
      );
    }

    const resetUrl = `${this.frontendUrl || 'http://localhost:3000'}/reset-password?token=${token}`;
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello${user.name ? ` ${user.name}` : ''},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2196F3; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p><small>This link will expire in 1 hour.</small></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
    `;

    // In development, optionally log email content instead of sending
    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[sendPasswordResetEmail] DEVELOPMENT MODE - Email would be sent to: ${user.email}`,
      );
      this.logger.warn(
        `[sendPasswordResetEmail] DEVELOPMENT MODE - Reset URL: ${resetUrl}`,
      );
      this.logger.warn(
        `[sendPasswordResetEmail] DEVELOPMENT MODE - Subject: Reset your ${appName} password`,
      );
      return;
    }

    this.logger.log(
      `[sendPasswordResetEmail] Attempting to send password reset email to: ${user.email}`,
    );

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: user.email,
        subject: `Reset your ${appName} password`,
        html,
      });

      const resendId =
        result && typeof result === 'object' && 'id' in result
          ? String((result as { id: unknown }).id)
          : 'N/A';
      const serializedResponse = (() => {
        try {
          return JSON.stringify(result);
        } catch {
          return '[unserializable response]';
        }
      })();
      this.logger.log(
        `[sendPasswordResetEmail] Password reset email sent successfully to: ${user.email}. Resend ID: ${resendId}. Response: ${serializedResponse}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendPasswordResetEmail] Error sending password reset email to ${user.email}: ${err.message}`,
        err.stack,
      );
      // Re-throw so the caller knows the email failed
      throw error;
    }
  }

  async sendWelcomeEmail(user: User): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const fromEmail = this.resendFrom;

    if (!fromEmail) {
      this.logger.warn('RESEND_FROM not configured. Skipping welcome email.');
      return;
    }

    if (!this.resend) {
      this.logger.warn(
        'Resend client not initialized. Skipping welcome email.',
      );
      return;
    }

    const frontendUrl = this.frontendUrl || 'http://localhost:3000';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${appName}, ${user.name || 'there'}!</h2>
        <p>Your email has been verified and your account is now active.</p>
        <p>You can now explore all the features ${appName} has to offer.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Get Started
          </a>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: `Welcome to ${appName}!`,
        html,
      });
      this.logger.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to send welcome email to ${user.email}:`,
        err.stack,
      );
      // Don't throw - welcome email is not critical
    }
  }
}
