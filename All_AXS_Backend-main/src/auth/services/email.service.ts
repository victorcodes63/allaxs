import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { User } from '../../users/entities/user.entity';
import {
  ticketToPdfContent,
  type TicketEmailEventInput,
  type TicketEmailTicketInput,
} from '../../tickets/ticket-email.util';
import { TicketPdfService } from '../../tickets/ticket-pdf.service';

type ResendSendResult = {
  data?: { id?: string } | null;
  error?: { message?: string; statusCode?: number; name?: string };
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly emailProvider: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string | undefined;
  private readonly frontendUrl: string | undefined;
  private readonly emailLogoUrl: string | undefined;
  private readonly isDevelopment: boolean;

  // Brand palette (must stay in sync with `app/globals.css` tokens)
  private static readonly BRAND_PRIMARY = '#f07241';
  private static readonly BRAND_PRIMARY_DARK = '#c02942';
  private static readonly BRAND_PURPLE = '#601848';
  private static readonly BRAND_GRADIENT = `linear-gradient(118deg, ${EmailService.BRAND_PRIMARY} 0%, ${EmailService.BRAND_PRIMARY_DARK} 52%, ${EmailService.BRAND_PURPLE} 100%)`;

  constructor(
    private readonly configService: ConfigService,
    private readonly ticketPdfService: TicketPdfService,
  ) {
    this.emailProvider = this.configService
      .get<string>('EMAIL_PROVIDER', 'resend')
      .toLowerCase();
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resendFrom = this.configService.get<string>('RESEND_FROM');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL');
    // Only use a logo URL when explicitly configured.
    // Email clients will show a broken-image icon if the URL is invalid/unreachable.
    this.emailLogoUrl = this.configService.get<string>('EMAIL_LOGO_URL');
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

  /** Resend's Node SDK returns `{ error }` instead of throwing for many API failures. */
  private assertResendSendOk(result: unknown, context: string): string {
    if (!result || typeof result !== 'object') {
      throw new Error(`${context}: unexpected Resend response`);
    }
    const r = result as ResendSendResult;
    if (r.error) {
      const detail = r.error.message ?? JSON.stringify(r.error);
      throw new Error(`${context}: ${detail}`);
    }
    const id = r.data?.id;
    if (!id) {
      throw new Error(`${context}: Resend returned no message id`);
    }
    return id;
  }

  private renderTicketSummaryRows(
    summary?: {
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      currency: string;
      couponCode?: string | null;
    },
  ): string {
    if (!summary) return '';
    const format = (cents: number) => {
      const major = Math.abs(cents) / 100;
      const formatted = major.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ${summary.currency}`;
    };
    const discountRow =
      summary.discountCents > 0
        ? `
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:6px 0;">
            Discount${summary.couponCode ? ` <span style=\"color:#6b7280;\">(${summary.couponCode})</span>` : ''}
          </td>
          <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#0b5fff;font-weight:600;padding:6px 0;">
            −${format(summary.discountCents)}
          </td>
        </tr>
      `
        : '';
    return `
      <tr>
        <td style="padding:0 24px 8px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:6px 0;">Subtotal</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:6px 0;">${format(summary.subtotalCents)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;padding:10px 0 0 0;border-top:1px solid #e5e7eb;">Total paid</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;padding:10px 0 0 0;border-top:1px solid #e5e7eb;">${format(summary.totalCents)}</td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  private renderEmailShell(input: {
    preheader: string;
    title: string;
    intro: string;
    actionLabel?: string;
    actionUrl?: string;
    linkLabel?: string;
    expiresText?: string;
    note?: string;
    bodyHtml?: string;
    footer?: string;
  }): string {
    const linkText = input.linkLabel ?? 'Or copy and paste this link into your browser:';
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const brandBlock = this.emailLogoUrl
      ? `<img src="${this.emailLogoUrl}" alt="${appName} logo" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;text-decoration:none;" />`
      : `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 10px 0 0; vertical-align:middle;">
              <div style="width:36px;height:36px;border-radius:12px;background:${EmailService.BRAND_PRIMARY};background-image:${EmailService.BRAND_GRADIENT};"></div>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:12px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:${EmailService.BRAND_PRIMARY};font-weight:900;">${appName}</p>
            </td>
          </tr>
        </table>
      `;
    const actionBlock =
      input.actionLabel && input.actionUrl
        ? `
          <tr>
            <td style="padding: 18px 0 10px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="border-radius: 12px; background: ${EmailService.BRAND_PRIMARY}; background-image: ${EmailService.BRAND_GRADIENT};">
                    <a href="${input.actionUrl}" style="display:inline-block;padding:15px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;line-height:16px;color:#ffffff;text-decoration:none;border-radius:12px;">
                      ${input.actionLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `
        : '';

    const breakableUrl = input.actionUrl
      ? input.actionUrl.replace(/([/?=&_.-])/g, '$1<wbr>')
      : '';

    const linkBlock = input.actionUrl
      ? `
        <tr>
          <td align="center" style="padding: 10px 28px 0 28px; text-align:center; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#0f172a;">
            ${linkText}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 6px 28px 0 28px; text-align:center; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; max-width:100%;">
            <span style="color:${EmailService.BRAND_PRIMARY}; font-weight:700; display:inline-block; max-width:100%; word-break:break-word; overflow-wrap:anywhere; text-align:center;">${breakableUrl}</span>
          </td>
        </tr>
      `
      : '';

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${input.title}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#eef2f7;">
          <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
            ${input.preheader}
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2f7;padding:28px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;border:1px solid #dbe3ef;">
                  <tr>
                    <td style="height:6px;line-height:6px;border-radius:18px 18px 0 0;background:${EmailService.BRAND_PRIMARY}; background-image:${EmailService.BRAND_GRADIENT};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:22px 28px 12px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                      <div style="display:inline-block;text-align:center;">
                        ${brandBlock}
                      </div>
                      <h1 style="margin:0;font-size:30px;line-height:36px;letter-spacing:-0.01em;color:#0f172a;">${input.title}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 28px 0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:28px;color:#334155;">
                      <p style="margin:0 0 8px 0;">${input.intro}</p>
                    </td>
                  </tr>
                  ${input.bodyHtml ?? ''}
                  ${actionBlock}
                  ${linkBlock}
                  ${
                    input.expiresText
                      ? `<tr><td align="center" style="padding:10px 28px 0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#64748b;">${input.expiresText}</td></tr>`
                      : ''
                  }
                  ${
                    input.note
                      ? `<tr><td align="center" style="padding:12px 28px 0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#64748b;">${input.note}</td></tr>`
                      : ''
                  }
                  <tr>
                    <td align="center" style="padding:24px 28px 24px 28px;text-align:center;">
                      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 12px 0;" />
                      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;">
                        ${input.footer ?? `Sent by ${this.configService.get<string>('APP_NAME', 'All AXS')}.`}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
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

    const html = this.renderEmailShell({
      preheader: `Verify your ${appName} account.`,
      title: `Welcome to ${appName}${user.name ? `, ${user.name}` : ''}`,
      intro: 'Thanks for registering. Confirm your email address to activate your account.',
      actionLabel: 'Verify Email Address',
      actionUrl: verificationUrl,
      expiresText: 'This verification link expires in 24 hours.',
      note: `If you didn't create an account with ${appName}, you can ignore this email.`,
    });

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

      const resendId = this.assertResendSendOk(
        result,
        'sendVerificationEmail',
      );
      this.logger.log(
        `[sendVerificationEmail] Verification email sent successfully to: ${user.email}. Resend ID: ${resendId}`,
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

    const html = this.renderEmailShell({
      preheader: `Reset your ${appName} password.`,
      title: 'Password Reset Request',
      intro: `Hello${user.name ? ` ${user.name}` : ''}, we received a request to reset your password.`,
      actionLabel: 'Reset Password',
      actionUrl: resetUrl,
      expiresText: 'This link will expire in 1 hour.',
      note: "If you didn't request this reset, you can safely ignore this email.",
    });

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

      const resendId = this.assertResendSendOk(
        result,
        'sendPasswordResetEmail',
      );
      this.logger.log(
        `[sendPasswordResetEmail] Password reset email sent successfully to: ${user.email}. Resend ID: ${resendId}`,
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

  async sendPasswordResetConfirmationEmail(user: User): Promise<void> {
    this.logger.log(
      `[sendPasswordResetConfirmationEmail] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      const errorMsg = `Email provider '${this.emailProvider}' is not supported. Only 'resend' is currently supported.`;
      this.logger.error(`[sendPasswordResetConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetConfirmationEmail] In development mode, email sending is disabled due to unsupported provider.`,
        );
      }
      return;
    }

    if (!this.resendApiKey) {
      const errorMsg =
        'RESEND_API_KEY is not configured. Password reset confirmation emails cannot be sent.';
      this.logger.error(`[sendPasswordResetConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetConfirmationEmail] In development mode, email sending is disabled due to missing RESEND_API_KEY.`,
        );
      }
      return;
    }

    if (!this.resendFrom) {
      const errorMsg =
        'RESEND_FROM is not configured. Password reset confirmation emails cannot be sent.';
      this.logger.error(`[sendPasswordResetConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordResetConfirmationEmail] In development mode, email sending is disabled due to missing RESEND_FROM.`,
        );
      }
      return;
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const loginUrl = `${this.frontendUrl || 'http://localhost:3000'}/login`;

    const html = this.renderEmailShell({
      preheader: `Your ${appName} password was changed successfully.`,
      title: 'Password updated',
      intro: `Hello${user.name ? ` ${user.name}` : ''}, your password was reset successfully. You can now sign in with your new password.`,
      actionLabel: 'Sign in',
      actionUrl: loginUrl,
      note: `If you didn't change your password, contact support immediately — your account may be compromised.`,
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[sendPasswordResetConfirmationEmail] DEVELOPMENT MODE - Email would be sent to: ${user.email}`,
      );
      this.logger.warn(
        `[sendPasswordResetConfirmationEmail] DEVELOPMENT MODE - Login URL: ${loginUrl}`,
      );
      this.logger.warn(
        `[sendPasswordResetConfirmationEmail] DEVELOPMENT MODE - Subject: Your ${appName} password was updated`,
      );
      return;
    }

    this.logger.log(
      `[sendPasswordResetConfirmationEmail] Attempting to send confirmation to: ${user.email}`,
    );

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: user.email,
        subject: `Your ${appName} password was updated`,
        html,
      });

      const resendId = this.assertResendSendOk(
        result,
        'sendPasswordResetConfirmationEmail',
      );
      this.logger.log(
        `[sendPasswordResetConfirmationEmail] Confirmation sent to: ${user.email}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendPasswordResetConfirmationEmail] Error sending to ${user.email}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(user: User): Promise<void> {
    this.logger.log(
      `[sendWelcomeEmail] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      const errorMsg = `Email provider '${this.emailProvider}' is not supported. Only 'resend' is currently supported.`;
      this.logger.error(`[sendWelcomeEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendWelcomeEmail] In development mode, email sending is disabled due to unsupported provider.`,
        );
      }
      return;
    }

    if (!this.resendApiKey) {
      const errorMsg =
        'RESEND_API_KEY is not configured. Welcome emails cannot be sent.';
      this.logger.error(`[sendWelcomeEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendWelcomeEmail] In development mode, email sending is disabled due to missing RESEND_API_KEY.`,
        );
      }
      return;
    }

    if (!this.resendFrom) {
      const errorMsg =
        'RESEND_FROM is not configured. Welcome emails cannot be sent.';
      this.logger.error(`[sendWelcomeEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendWelcomeEmail] In development mode, email sending is disabled due to missing RESEND_FROM.`,
        );
      }
      return;
    }

    if (!this.frontendUrl) {
      this.logger.warn(
        `[sendWelcomeEmail] FRONTEND_URL is not configured. Welcome email links may be incorrect.`,
      );
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const homeUrl = this.frontendUrl || 'http://localhost:3000';
    const eventsUrl = `${homeUrl}/events`;

    const html = this.renderEmailShell({
      preheader: `Welcome to ${appName} — your account is ready.`,
      title: `Welcome to ${appName}`,
      intro: `Hello${user.name ? ` ${user.name}` : ''}, your email is verified and your account is active. Discover events, book tickets, and manage your passes in one place.`,
      actionLabel: 'Browse events',
      actionUrl: eventsUrl,
      note: `If you didn't create an account with ${appName}, you can safely ignore this email.`,
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[sendWelcomeEmail] DEVELOPMENT MODE - Email would be sent to: ${user.email}`,
      );
      this.logger.warn(
        `[sendWelcomeEmail] DEVELOPMENT MODE - Events URL: ${eventsUrl}`,
      );
      this.logger.warn(
        `[sendWelcomeEmail] DEVELOPMENT MODE - Subject: Welcome to ${appName}`,
      );
      return;
    }

    this.logger.log(
      `[sendWelcomeEmail] Attempting to send welcome email to: ${user.email}`,
    );

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: user.email,
        subject: `Welcome to ${appName}`,
        html,
      });

      const resendId = this.assertResendSendOk(result, 'sendWelcomeEmail');
      this.logger.log(
        `[sendWelcomeEmail] Welcome email sent successfully to: ${user.email}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendWelcomeEmail] Error sending welcome email to ${user.email}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async sendTicketEmail(input: {
    buyerName: string;
    buyerEmail: string;
    eventTitle: string;
    event?: TicketEmailEventInput;
    tickets: TicketEmailTicketInput[];
    /**
     * Optional payment summary block (COUPONS_SPEC §8). When provided we
     * render a `Subtotal / Discount / Total paid` table so buyers see the
     * coupon attribution and the final amount in the same email.
     */
    summary?: {
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      currency: string;
      couponCode?: string | null;
    };
  }): Promise<void> {
    if (!input.tickets.length) return;
    if (!this.resend || !this.resendFrom) {
      this.logger.warn(
        `[sendTicketEmail] Email provider unavailable, skipping ticket email for ${input.buyerEmail}`,
      );
      return;
    }

    const frontendUrl = this.frontendUrl || 'http://localhost:3000';
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const eventContext: TicketEmailEventInput = input.event ?? {
      title: input.eventTitle,
    };

    type ResendAttachment = {
      filename: string;
      content: string;
      content_type?: string;
      content_id?: string;
    };

    const attachments: ResendAttachment[] = [];

    const ticketRows = await Promise.all(
      input.tickets.map(async (ticket, index) => {
        const pdfContent = ticketToPdfContent(
          ticket,
          eventContext,
          input.buyerEmail,
        );
        const pdfBuffer = await this.ticketPdfService.buildTicketPdfBuffer(
          pdfContent,
        );
        const shortId = ticket.id.slice(0, 8);
        const pdfFilename =
          input.tickets.length > 1
            ? `ticket-${index + 1}-${shortId}.pdf`
            : `ticket-${shortId}.pdf`;
        attachments.push({
          filename: pdfFilename,
          content: pdfBuffer.toString('base64'),
          content_type: 'application/pdf',
        });

        const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;
        return `
          <tr>
            <td style="border:1px solid #e5e7eb;border-radius:12px;padding:16px 16px 12px 16px;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;">${ticket.tierName}</p>
              <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#64748b;">
                Your scannable pass is in the attached PDF <strong style="color:#111827;">${pdfFilename}</strong>. Open it on your phone or print it for entry.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;">
                <a href="${ticketUrl}" style="color:#0b5fff;text-decoration:none;font-weight:700;">View ticket online</a>
              </p>
            </td>
          </tr>
          <tr><td style="height:12px;line-height:12px;">&nbsp;</td></tr>
        `;
      }),
    );

    const summaryHtml = this.renderTicketSummaryRows(input.summary);
    const pdfNote =
      input.tickets.length === 1
        ? 'Your ticket PDF is attached — open it at the door to scan the QR code.'
        : `${input.tickets.length} ticket PDFs are attached — open each pass at the door to scan the QR code.`;

    const html = this.renderEmailShell({
      preheader: `Your tickets for ${input.eventTitle} are ready.`,
      title: `Your tickets for ${input.eventTitle}`,
      intro: `Hello ${input.buyerName || 'there'}, your payment was successful and your tickets are ready. ${pdfNote}`,
      actionLabel: 'View all tickets',
      actionUrl: `${frontendUrl}/tickets`,
      bodyHtml: `
        ${summaryHtml}
        <tr>
          <td style="padding:12px 24px 4px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              ${ticketRows.join('')}
            </table>
          </td>
        </tr>
      `,
      footer: `Sent by ${appName}.`,
    });

    const ticketSendResult = await this.resend.emails.send({
      from: this.resendFrom,
      to: input.buyerEmail,
      subject: `Your tickets for ${input.eventTitle}`,
      html,
      attachments,
    });
    const ticketId = this.assertResendSendOk(ticketSendResult, 'sendTicketEmail');
    this.logger.log(
      `[sendTicketEmail] Sent to ${input.buyerEmail} with ${attachments.length} attachment(s) (Resend ID: ${ticketId})`,
    );
  }
}
