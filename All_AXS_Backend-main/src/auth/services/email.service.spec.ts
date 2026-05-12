import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
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
        html: expect.stringContaining('Verify Email Address'),
      });
    });

    it('should handle user without name', async () => {
      const user = createMockUser({ name: undefined });
      await service.sendVerificationEmail(user, 'test-token');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          html: expect.stringContaining('Welcome to Test App'),
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
        html: expect.stringContaining('Reset Password'),
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

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const user = createMockUser();
      await service.sendWelcomeEmail(user);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'test@example.com',
        subject: 'Welcome to Test App!',
        html: expect.stringContaining('Welcome to Test App'),
      });
    });
  });
});
