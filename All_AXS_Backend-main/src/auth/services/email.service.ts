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
    this.emailLogoUrl = this.resolveEmailLogoUrl();
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

    if (this.emailLogoUrl) {
      const explicit = this.configService.get<string>('EMAIL_LOGO_URL')?.trim();
      if (explicit) {
        this.logger.log(`Email header logo: EMAIL_LOGO_URL`);
      } else {
        this.logger.log(
          `Email header logo: ${this.emailLogoUrl} (derived from FRONTEND_URL)`,
        );
      }
    } else {
      this.logger.warn(
        'No email header logo URL (set EMAIL_LOGO_URL or FRONTEND_URL). Emails use text fallback branding.',
      );
    }
  }

  /**
   * Wordmark for HTML emails (white card). Matches Web `public/brand/logo-header.png`.
   * Override with EMAIL_LOGO_URL when hosting elsewhere.
   */
  private resolveEmailLogoUrl(): string | undefined {
    const explicit = this.configService.get<string>('EMAIL_LOGO_URL')?.trim();
    if (explicit) return explicit;
    const base = this.configService.get<string>('FRONTEND_URL')?.trim();
    if (!base) return undefined;
    return `${base.replace(/\/$/, '')}/brand/logo-header.png`;
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
      ? `<img src="${this.emailLogoUrl}" alt="${appName}" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;" />`
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
      title: `Verify your email${user.name ? `, ${user.name}` : ''}`,
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

  async sendPasswordChangeConfirmationEmail(user: User): Promise<void> {
    this.logger.log(
      `[sendPasswordChangeConfirmationEmail] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      const errorMsg = `Email provider '${this.emailProvider}' is not supported. Only 'resend' is currently supported.`;
      this.logger.error(`[sendPasswordChangeConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordChangeConfirmationEmail] In development mode, email sending is disabled due to unsupported provider.`,
        );
      }
      return;
    }

    if (!this.resendApiKey) {
      const errorMsg =
        'RESEND_API_KEY is not configured. Password change confirmation emails cannot be sent.';
      this.logger.error(`[sendPasswordChangeConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordChangeConfirmationEmail] In development mode, email sending is disabled due to missing RESEND_API_KEY.`,
        );
      }
      return;
    }

    if (!this.resendFrom) {
      const errorMsg =
        'RESEND_FROM is not configured. Password change confirmation emails cannot be sent.';
      this.logger.error(`[sendPasswordChangeConfirmationEmail] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[sendPasswordChangeConfirmationEmail] In development mode, email sending is disabled due to missing RESEND_FROM.`,
        );
      }
      return;
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const forgotPasswordUrl = `${this.frontendUrl || 'http://localhost:3000'}/forgot-password`;

    const html = this.renderEmailShell({
      preheader: `Your ${appName} password was changed from account settings.`,
      title: 'Password changed',
      intro: `Hello${user.name ? ` ${user.name}` : ''}, your password was changed successfully from your account settings. All other sessions were signed out for your security.`,
      actionLabel: 'Reset password',
      actionUrl: forgotPasswordUrl,
      note: `If this wasn't you, contact support immediately — your account may be compromised. You can also use the link above to request a password reset.`,
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[sendPasswordChangeConfirmationEmail] DEVELOPMENT MODE - Email would be sent to: ${user.email}`,
      );
      this.logger.warn(
        `[sendPasswordChangeConfirmationEmail] DEVELOPMENT MODE - Forgot password URL: ${forgotPasswordUrl}`,
      );
      this.logger.warn(
        `[sendPasswordChangeConfirmationEmail] DEVELOPMENT MODE - Subject: Your ${appName} password was changed`,
      );
      return;
    }

    this.logger.log(
      `[sendPasswordChangeConfirmationEmail] Attempting to send confirmation to: ${user.email}`,
    );

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: user.email,
        subject: `Your ${appName} password was changed`,
        html,
      });

      const resendId = this.assertResendSendOk(
        result,
        'sendPasswordChangeConfirmationEmail',
      );
      this.logger.log(
        `[sendPasswordChangeConfirmationEmail] Confirmation sent to: ${user.email}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendPasswordChangeConfirmationEmail] Error sending to ${user.email}: ${err.message}`,
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

  /**
   * Notifies the organizer or an admin when an event enters the moderation queue.
   */
  async sendEventSubmittedForReviewEmail(
    input: {
      to: string;
      recipientName?: string | null;
      eventTitle: string;
      eventId: string;
      orgName?: string | null;
      venue?: string | null;
      startAt: Date;
      audience: 'organizer' | 'admin';
    },
  ): Promise<void> {
    const context = 'sendEventSubmittedForReviewEmail';
    this.logger.log(
      `[${context}] Entry (${input.audience}) - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      this.logger.error(
        `[${context}] Email provider '${this.emailProvider}' is not supported.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    if (!this.resendApiKey || !this.resendFrom) {
      this.logger.error(
        `[${context}] RESEND_API_KEY or RESEND_FROM is not configured.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const homeUrl = (this.frontendUrl || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const isAdmin = input.audience === 'admin';
    const actionUrl = isAdmin
      ? `${homeUrl}/admin/moderation`
      : `${homeUrl}/organizer/events/${input.eventId}/edit`;
    const greeting = input.recipientName?.trim()
      ? `Hello ${input.recipientName.trim()},`
      : 'Hello,';
    const whenLabel = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(input.startAt);
    const orgLine = input.orgName?.trim()
      ? `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:4px 0;">Organizer</td><td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:4px 0;">${input.orgName.trim()}</td></tr>`
      : '';
    const venueLine = input.venue?.trim()
      ? `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:4px 0;">Venue</td><td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:4px 0;">${input.venue.trim()}</td></tr>`
      : '';

    const bodyHtml = `
      <tr>
        <td style="padding:8px 28px 0 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
            <tr>
              <td colspan="2" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;padding:0 0 8px 0;">${input.eventTitle}</td>
            </tr>
            ${orgLine}
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:4px 0;">Starts</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:4px 0;">${whenLabel}</td>
            </tr>
            ${venueLine}
          </table>
        </td>
      </tr>
    `;

    const subject = isAdmin
      ? `Review needed: ${input.eventTitle}`
      : `Submitted for review: ${input.eventTitle}`;
    const title = isAdmin ? 'Event awaiting review' : 'Event submitted for review';
    const intro = isAdmin
      ? `${greeting} <strong>${input.eventTitle}</strong> was submitted and is waiting in the moderation queue. Please review it when you can so the organizer can go live sooner.`
      : `${greeting} we received <strong>${input.eventTitle}</strong> for review. Our team will check the details and notify you once it is approved or if changes are needed.`;
    const actionLabel = isAdmin ? 'Open moderation queue' : 'View your event';
    const preheader = isAdmin
      ? `${input.eventTitle} is waiting for admin review on ${appName}.`
      : `${input.eventTitle} was submitted for review on ${appName}.`;

    const html = this.renderEmailShell({
      preheader,
      title,
      intro,
      bodyHtml,
      actionLabel,
      actionUrl,
      note: isAdmin
        ? 'You are receiving this because you have admin access on All AXS.'
        : 'Typical review times are within one business day. You can still edit media and ticket tiers while the event is pending review.',
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[${context}] DEVELOPMENT MODE - Email would be sent to: ${input.to}`,
      );
      this.logger.warn(`[${context}] DEVELOPMENT MODE - Subject: ${subject}`);
      this.logger.warn(`[${context}] DEVELOPMENT MODE - URL: ${actionUrl}`);
      return;
    }

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: input.to,
        subject,
        html,
      });

      const resendId = this.assertResendSendOk(result, context);
      this.logger.log(
        `[${context}] Sent (${input.audience}) to ${input.to}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${context}] Error sending to ${input.to}: ${err.message}`,
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
    /** Magic link to set a password / open the ticket wallet. */
    accessUrl?: string;
    /** True when the buyer account was auto-provisioned at checkout. */
    accountCreated?: boolean;
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

    const accountNote = input.accountCreated
      ? ' We also created an All AXS account so you can manage your passes online — use the button below to access your tickets (no password required until you choose to set one).'
      : input.accessUrl
        ? ' Use the button below to access your ticket wallet anytime.'
        : '';

    const primaryActionUrl = input.accessUrl ?? `${frontendUrl}/tickets`;
    const primaryActionLabel = input.accessUrl
      ? 'Access your tickets'
      : 'View all tickets';

    const accountBanner = input.accountCreated
      ? `
        <tr>
          <td style="padding:0 24px 12px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#334155;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;">
              <strong style="color:#0f172a;">Your account has been created.</strong>
              We saved this purchase to ${input.buyerEmail}. You can open your passes now using the secure link below — set a password when it suits you.
            </p>
          </td>
        </tr>
      `
      : '';

    const html = this.renderEmailShell({
      preheader: `Your tickets for ${input.eventTitle} are ready.`,
      title: `Your tickets for ${input.eventTitle}`,
      intro: `Hello ${input.buyerName || 'there'}, your payment was successful and your tickets are ready. ${pdfNote}${accountNote}`,
      actionLabel: primaryActionLabel,
      actionUrl: primaryActionUrl,
      bodyHtml: `
        ${accountBanner}
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

  /**
   * Notifies the buyer after a successful order refund (full or partial).
   */
  async sendOrderRefundEmail(input: {
    buyerEmail: string;
    buyerName?: string | null;
    orderReference: string;
    eventTitle: string;
    refundAmountCents: number;
    currency: string;
    isPartialRefund?: boolean;
  }): Promise<void> {
    const context = 'sendOrderRefundEmail';
    this.logger.log(
      `[${context}] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      this.logger.error(
        `[${context}] Email provider '${this.emailProvider}' is not supported.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    if (!this.resendApiKey || !this.resendFrom) {
      this.logger.error(
        `[${context}] RESEND_API_KEY or RESEND_FROM is not configured.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    const homeUrl = (this.frontendUrl || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const ticketsUrl = `${homeUrl}/tickets`;
    const supportEmail = 'hello@allaxs.com';
    const supportUrl = `mailto:${supportEmail}`;
    const greeting = input.buyerName?.trim()
      ? `Hello ${input.buyerName.trim()},`
      : 'Hello,';
    const refundLabel = input.isPartialRefund ? 'Partial refund' : 'Refund amount';
    const amountLabel = this.formatMoney(
      input.refundAmountCents,
      input.currency,
    );

    const bodyHtml = `
      <tr>
        <td style="padding:8px 28px 0 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:4px 0;">Order reference</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;font-weight:600;padding:4px 0;">${input.orderReference}</td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#6b7280;padding:4px 0;">Event</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#111827;padding:4px 0;">${input.eventTitle}</td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;padding:10px 0 0 0;border-top:1px solid #e5e7eb;">${refundLabel}</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;padding:10px 0 0 0;border-top:1px solid #e5e7eb;">${amountLabel}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:14px 28px 0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#64748b;">
          Your tickets for this order are no longer valid for entry. Refunds typically appear on your original payment method within 5–10 business days.
          <br /><br />
          Questions? <a href="${supportUrl}" style="color:#0b5fff;text-decoration:none;font-weight:700;">Contact support</a>
        </td>
      </tr>
    `;

    const subject = input.isPartialRefund
      ? `Partial refund for ${input.eventTitle}`
      : `Refund processed for ${input.eventTitle}`;
    const title = input.isPartialRefund ? 'Partial refund issued' : 'Refund processed';
    const intro = `${greeting} we processed a ${input.isPartialRefund ? 'partial ' : ''}refund for your order for <strong>${input.eventTitle}</strong>.`;

    const html = this.renderEmailShell({
      preheader: `${refundLabel}: ${amountLabel} for ${input.eventTitle}.`,
      title,
      intro,
      bodyHtml,
      actionLabel: 'View my tickets',
      actionUrl: ticketsUrl,
      note: `If you did not expect this refund, contact ${supportEmail} right away.`,
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[${context}] DEVELOPMENT MODE - Email would be sent to: ${input.buyerEmail}`,
      );
      this.logger.warn(`[${context}] DEVELOPMENT MODE - Subject: ${subject}`);
      this.logger.warn(`[${context}] DEVELOPMENT MODE - URL: ${ticketsUrl}`);
      return;
    }

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: input.buyerEmail,
        subject,
        html,
      });

      const resendId = this.assertResendSendOk(result, context);
      this.logger.log(
        `[${context}] Sent to ${input.buyerEmail}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${context}] Error sending to ${input.buyerEmail}: ${err.message}`,
        err.stack,
      );
      // Do not rethrow — refund already succeeded; email must not block the response.
    }
  }

  private formatMoney(cents: number, currency: string): string {
    const major = Math.abs(cents) / 100;
    const formatted = major.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} ${currency}`;
  }

  /**
   * Sends a volunteer scanner-link invite email.
   * The email contains nothing about attendees — only the scanner URL and label.
   */
  async sendScannerInviteEmail(input: {
    to: string;
    label: string;
    eventTitle: string;
    scanUrl: string;
    expiresAt: Date;
    organizerName: string;
  }): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');

    if (this.emailProvider !== 'resend' || !this.resend || !this.resendFrom) {
      this.logger.warn(
        `[sendScannerInviteEmail] Email not configured — would have sent scanner invite to ${input.to}`,
      );
      this.logger.warn(`[sendScannerInviteEmail] Scanner URL: ${input.scanUrl}`);
      return;
    }

    const expiryStr = input.expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = this.renderEmailShell({
      preheader: `You've been invited to scan tickets for ${input.eventTitle}.`,
      title: `You're a door scanner for ${input.eventTitle}`,
      intro: `${input.organizerName} has invited you to check in guests at <strong>${input.label}</strong>. Tap the button below on your phone to open the scanner — no account or login required.`,
      actionLabel: 'Open Scanner',
      actionUrl: input.scanUrl,
      linkLabel: 'Or copy this link and open it on your phone:',
      expiresText: `This scanner link is valid until ${expiryStr}. After that it will stop working automatically.`,
      note: `If you weren't expecting this, ignore this email. The link only works for the event it was created for.`,
      footer: `Sent by ${input.organizerName} via ${appName}.`,
    });

    try {
      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: input.to,
        subject: `Scanner invite: ${input.label} — ${input.eventTitle}`,
        html,
      });
      const id = this.assertResendSendOk(result, 'sendScannerInviteEmail');
      this.logger.log(
        `[sendScannerInviteEmail] Sent scanner invite to ${input.to} (Resend ID: ${id})`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[sendScannerInviteEmail] Failed to send to ${input.to}: ${err.message}`,
        err.stack,
      );
      // Do not rethrow — email failure must not block session creation
    }
  }

  /** Invites a co-organizer to join an organization team. */
  async sendOrganizationInviteEmail(input: {
    to: string;
    orgName: string;
    role: string;
    token: string;
    inviterName?: string | null;
  }): Promise<void> {
    const context = 'sendOrganizationInviteEmail';
    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const homeUrl = (this.frontendUrl || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const acceptUrl = `${homeUrl}/organizer/team/join?token=${encodeURIComponent(input.token)}`;
    const roleLabel =
      input.role === 'SCANNER'
        ? 'Scanner'
        : input.role === 'EDITOR'
          ? 'Editor'
          : input.role;
    const inviter = input.inviterName?.trim() || 'An organizer';

    if (this.emailProvider !== 'resend' || !this.resend || !this.resendFrom) {
      this.logger.warn(
        `[${context}] Email not configured — would have sent invite to ${input.to}`,
      );
      this.logger.warn(`[${context}] Accept URL: ${acceptUrl}`);
      return;
    }

    const html = this.renderEmailShell({
      preheader: `Join ${input.orgName} on ${appName} as ${roleLabel}.`,
      title: `You're invited to ${input.orgName}`,
      intro: `${inviter} invited you to join <strong>${input.orgName}</strong> as <strong>${roleLabel}</strong>. Sign in with this email address and accept the invite to access the organizer dashboard.`,
      actionLabel: 'Accept invitation',
      actionUrl: acceptUrl,
      linkLabel: 'Or copy this link:',
      expiresText: 'This invitation expires in 7 days.',
      note: `If you weren't expecting this invite, you can ignore this email.`,
      footer: `Sent by ${appName}.`,
    });

    try {
      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: input.to,
        subject: `Invitation to join ${input.orgName} on ${appName}`,
        html,
      });
      const id = this.assertResendSendOk(result, context);
      this.logger.log(
        `[${context}] Sent organization invite to ${input.to} (Resend ID: ${id})`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${context}] Failed to send to ${input.to}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Notifies the next waitlist buyer when a tier seat opens after a refund.
   */
  async sendWaitlistSpotAvailableEmail(input: {
    to: string;
    eventTitle: string;
    tierName: string;
    purchaseUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    const context = 'sendWaitlistSpotAvailableEmail';
    this.logger.log(
      `[${context}] Entry - Provider: ${this.emailProvider}, From: ${this.resendFrom || 'NOT CONFIGURED'}`,
    );

    if (this.emailProvider !== 'resend') {
      this.logger.error(
        `[${context}] Email provider '${this.emailProvider}' is not supported.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    if (!this.resendApiKey || !this.resendFrom) {
      this.logger.error(
        `[${context}] RESEND_API_KEY or RESEND_FROM is not configured.`,
      );
      if (this.isDevelopment) return;
      return;
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const expiryStr = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(input.expiresAt);

    const html = this.renderEmailShell({
      preheader: `A spot opened for ${input.tierName} — ${input.eventTitle}`,
      title: 'Your waitlist spot is ready',
      intro: `Good news — a ticket opened up for <strong>${input.tierName}</strong> at <strong>${input.eventTitle}</strong>. Complete checkout before the link expires to secure your place.`,
      actionLabel: 'Complete purchase',
      actionUrl: input.purchaseUrl,
      linkLabel: 'Or copy this checkout link:',
      expiresText: `This link expires at ${expiryStr} (30 minutes). If you miss the window, the next person on the waitlist may be notified.`,
      note: 'Use the same email address you joined the waitlist with when checking out.',
      footer: `Sent by ${appName}.`,
    });

    if (
      this.isDevelopment &&
      (!this.resend || !this.resendApiKey || !this.resendFrom)
    ) {
      this.logger.warn(
        `[${context}] DEVELOPMENT MODE - Email would be sent to: ${input.to}`,
      );
      this.logger.warn(`[${context}] DEVELOPMENT MODE - URL: ${input.purchaseUrl}`);
      return;
    }

    try {
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to: input.to,
        subject: `Spot available: ${input.tierName} — ${input.eventTitle}`,
        html,
      });

      const resendId = this.assertResendSendOk(result, context);
      this.logger.log(
        `[${context}] Sent to ${input.to}. Resend ID: ${resendId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${context}] Error sending to ${input.to}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /** Batch-send organizer announcements with a fixed delay between sends. */
  async sendOrganizerAnnouncementBatch(input: {
    recipients: string[];
    subject: string;
    eventTitle: string;
    bodyHtml: string;
  }): Promise<{ sent: number; failed: number }> {
    const context = 'sendOrganizerAnnouncementBatch';
    const delayMs = 550;

    if (this.emailProvider !== 'resend') {
      this.logger.error(
        `[${context}] Email provider '${this.emailProvider}' is not supported.`,
      );
      if (this.isDevelopment) {
        return { sent: 0, failed: input.recipients.length };
      }
      throw new Error(`Unsupported email provider: ${this.emailProvider}`);
    }

    if (!this.resendApiKey || !this.resendFrom || !this.resend) {
      const errorMsg =
        'RESEND_API_KEY or RESEND_FROM is not configured. Announcement emails cannot be sent.';
      this.logger.error(`[${context}] ${errorMsg}`);
      if (this.isDevelopment) {
        this.logger.warn(
          `[${context}] DEVELOPMENT MODE - Would send to ${input.recipients.length} recipient(s)`,
        );
        return { sent: 0, failed: input.recipients.length };
      }
      throw new Error(errorMsg);
    }

    const appName = this.configService.get<string>('APP_NAME', 'All AXS');
    const wrappedBody = `
      <tr>
        <td style="padding:8px 28px 0 28px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#334155;">
            ${input.bodyHtml}
          </div>
        </td>
      </tr>
    `;

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < input.recipients.length; i++) {
      const to = input.recipients[i];
      const html = this.renderEmailShell({
        preheader: input.subject,
        title: input.eventTitle,
        intro: `You have a message from the organizer of <strong>${input.eventTitle}</strong>:`,
        bodyHtml: wrappedBody,
        footer: `This message was sent by the event organizer via ${appName}. If you have questions about your tickets, reply to the organizer or contact support through your order confirmation.`,
      });

      try {
        const result = await this.resend.emails.send({
          from: this.resendFrom,
          to,
          subject: input.subject,
          html,
        });
        this.assertResendSendOk(result, context);
        sent++;
      } catch (error) {
        failed++;
        const err = error as Error;
        this.logger.error(
          `[${context}] Failed to send announcement to ${to}: ${err.message}`,
          err.stack,
        );
      }

      if (i < input.recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.logger.log(
      `[${context}] Finished batch for "${input.eventTitle}": sent=${sent}, failed=${failed}`,
    );
    return { sent, failed };
  }
}
