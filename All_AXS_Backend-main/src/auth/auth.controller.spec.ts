import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../domain/enums';
import type { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      roles: [Role.ATTENDEE],
    },
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    },
  };

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'Test Agent' },
  } as unknown as Request;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto, mockRequest);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto, {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto, {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const refreshToken = 'old-refresh-token';
      const response = {
        user: mockAuthResponse.user,
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      authService.refreshTokens.mockResolvedValue(response);

      const result = await controller.refresh(refreshToken, mockRequest);

      expect(result).toEqual(response);
      expect(authService.refreshTokens).toHaveBeenCalledWith(refreshToken, {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });
    });

    it('should throw error if refresh token is missing', async () => {
      await expect(controller.refresh('', mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      const refreshToken = 'token-to-revoke';

      await controller.logout(refreshToken, undefined);

      expect(authService.logout).toHaveBeenCalledWith('', refreshToken);
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        roles: [Role.ATTENDEE],
      };

      await controller.logoutAll(user);

      expect(authService.logoutAll).toHaveBeenCalledWith('123');
    });
  });

  describe('getMe', () => {
    it('should return current user', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        roles: [Role.ATTENDEE],
      };

      const result = controller.getMe(user);

      expect(result).toEqual({ user });
    });
  });
});
