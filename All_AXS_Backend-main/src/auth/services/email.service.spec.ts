import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { TicketPdfService } from '../../tickets/ticket-pdf.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../domain/enums';

// Mock Resend to prevent actual API calls
const mockResendSend = jest
  .fn()
  .mockResolvedValue({ data: { id: 'test-email-id' }, error: null });

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: mockResendSend,
      },
    })),
  };
});

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockResendSend.mockClear();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                RESEND_API_KEY: 're_test_key',
                RESEND_FROM: 'noreply@test.com',
                FRONTEND_URL: 'http://localhost:3000',
                APP_NAME: 'Test App',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: TicketPdfService,
          useValue: {
            buildTicketPdfBuffer: jest
              .fn()
              .mockResolvedValue(Buffer.from('%PDF-smoke')),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const createMockUser = (overrides?: Partial<User>): User => {
    const user = new User();
    user.id = 'user-id-123';
    user.email = 'test@example.com';
    user.name = 'Test User';
    user.roles = [Role.ATTENDEE];
    return Object.assign(user, overrides);
  };

  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      const user = createMockUser();
      await service.sendVerificationEmail(user, 'test-token');

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Verify your Test App account',
        html: expect.stringMatching(
          /Verify Email Address[\s\S]*\/brand\/logo-header\.png/,
        ),
      });
    });

    it('should handle user without name', async () => {
      const user = createMockUser({ name: undefined });
      await service.sendVerificationEmail(user, 'test-token');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          html: expect.stringContaining('Verify your email'),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const user = createMockUser();
      await service.sendPasswordResetEmail(user, 'reset-token');

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Reset your Test App password',
        html: expect.stringMatching(
          /Reset Password[\s\S]*\/brand\/logo-header\.png/,
        ),
      });
    });

    it('should handle user without name', async () => {
      const user = createMockUser({ name: undefined });
      await service.sendPasswordResetEmail(user, 'reset-token');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          html: expect.stringContaining('Hello'),
        }),
      );
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send password reset confirmation email successfully', async () => {
      const user = createMockUser();
      await service.sendPasswordResetConfirmationEmail(user);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Your Test App password was updated',
        html: expect.stringContaining('Sign in'),
      });
    });
  });

  describe('sendPasswordChangeConfirmationEmail', () => {
    it('should send password change confirmation email successfully', async () => {
      const user = createMockUser();
      await service.sendPasswordChangeConfirmationEmail(user);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Your Test App password was changed',
        html: expect.stringMatching(
          /Password changed[\s\S]*\/forgot-password[\s\S]*If this wasn't you, contact support/,
        ),
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const user = createMockUser();
      await service.sendWelcomeEmail(user);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Welcome to Test App',
        html: expect.stringMatching(
          /Welcome to Test App[\s\S]*\/brand\/logo-header\.png/,
        ),
      });
    });
  });

  describe('sendPaymentReceiptEmail', () => {
    it('sends Paystack-style receipt with reference and amount', async () => {
      await service.sendPaymentReceiptEmail({
        buyerEmail: 'buyer@example.com',
        buyerName: 'Buyer User',
        organizerName: 'Raven Tech Group',
        organizerSupportEmail: 'support@example.com',
        eventTitle: 'Summer Fest',
        paymentReference: 'pay_abc123',
        orderReference: 'pay_abc123',
        paidAt: new Date('2026-05-23T09:35:00Z'),
        amountCents: 24900,
        currency: 'KES',
        paymentMethodLabel: 'M-PESA ···· X519',
        orderConfirmationUrl: 'https://www.axs.africa/orders/abc/confirmation',
        ticketsPending: true,
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@example.com',
          subject: 'Receipt from Raven Tech Group [pay_abc123]',
          html: expect.stringMatching(
            /Raven Tech Group received your payment of[\s\S]*249\.00 KES[\s\S]*pay_abc123[\s\S]*M-PESA ···· X519[\s\S]*ticket PDFs with QR codes will arrive in a separate email/,
          ),
        }),
      );
    });
  });

  describe('sendOrderRefundEmail', () => {
    it('sends refund confirmation with tickets and support links', async () => {
      await service.sendOrderRefundEmail({
        buyerEmail: 'buyer@example.com',
        buyerName: 'Buyer User',
        orderReference: 'AXS-REF-12345',
        eventTitle: 'Summer Fest',
        refundAmountCents: 150000,
        currency: 'KES',
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@example.com',
          subject: 'Refund processed for Summer Fest',
          html: expect.stringMatching(
            /View my tickets[\s\S]*\/tickets[\s\S]*Contact support[\s\S]*AXS-REF-12345/,
          ),
        }),
      );
    });

    it('uses partial refund copy when flagged', async () => {
      await service.sendOrderRefundEmail({
        buyerEmail: 'buyer@example.com',
        orderReference: 'AXS-REF-99',
        eventTitle: 'Summer Fest',
        refundAmountCents: 50000,
        currency: 'KES',
        isPartialRefund: true,
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Partial refund for Summer Fest',
          html: expect.stringContaining('Partial refund issued'),
        }),
      );
    });
  });

  describe('sendEventSubmittedForReviewEmail', () => {
    it('sends admin moderation email with queue link', async () => {
      await service.sendEventSubmittedForReviewEmail({
        to: 'admin@example.com',
        recipientName: 'Admin User',
        eventTitle: 'Jazz Night',
        eventId: 'event-uuid-1',
        orgName: 'Acme Events',
        venue: 'The Loft',
        startAt: new Date('2026-06-15T18:00:00.000Z'),
        audience: 'admin',
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: 'Review needed: Jazz Night',
          html: expect.stringContaining('/admin/moderation'),
        }),
      );
    });

    it('sends organizer confirmation with editor link', async () => {
      await service.sendEventSubmittedForReviewEmail({
        to: 'organizer@example.com',
        recipientName: 'Organizer',
        eventTitle: 'Jazz Night',
        eventId: 'event-uuid-1',
        orgName: 'Acme Events',
        venue: 'The Loft',
        startAt: new Date('2026-06-15T18:00:00.000Z'),
        audience: 'organizer',
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'organizer@example.com',
          subject: 'Submitted for review: Jazz Night',
          html: expect.stringContaining('/organizer/events/event-uuid-1/edit'),
        }),
      );
    });
  });

  describe('email header logo', () => {
    it('prefers EMAIL_LOGO_URL over FRONTEND_URL default', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          RESEND_API_KEY: 're_test_key',
          RESEND_FROM: 'noreply@test.com',
          FRONTEND_URL: 'http://localhost:3000',
          EMAIL_LOGO_URL: 'https://cdn.example/custom-logo.png',
          APP_NAME: 'Test App',
        };
        return config[key] ?? defaultValue;
      });

      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configService },
          {
            provide: TicketPdfService,
            useValue: {
              buildTicketPdfBuffer: jest
                .fn()
                .mockResolvedValue(Buffer.from('%PDF-smoke')),
            },
          },
        ],
      }).compile();

      const logoService = module.get(EmailService);
      const user = createMockUser();
      await logoService.sendWelcomeEmail(user);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://cdn.example/custom-logo.png'),
        }),
      );
    });
  });
});
