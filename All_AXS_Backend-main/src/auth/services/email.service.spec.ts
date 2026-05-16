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
