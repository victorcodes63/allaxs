import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../domain/enums';
import type { CurrentUser } from '../decorators/current-user.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: { user?: CurrentUser };

    beforeEach(() => {
      mockRequest = {};
      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
    });

    it('should allow access when no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should allow access when user has required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        id: 'user-id',
        email: 'admin@example.com',
        roles: [Role.ADMIN],
      };

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Role.ADMIN, Role.ORGANIZER]);
      mockRequest.user = {
        id: 'user-id',
        email: 'organizer@example.com',
        roles: [Role.ORGANIZER],
      };

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        id: 'user-id',
        email: 'user@example.com',
        roles: [Role.ATTENDEE],
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Insufficient permissions',
      );
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = undefined;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'User not authenticated',
      );
    });

    it('should throw ForbiddenException when user has no roles', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        id: 'user-id',
        email: 'user@example.com',
        roles: [],
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
