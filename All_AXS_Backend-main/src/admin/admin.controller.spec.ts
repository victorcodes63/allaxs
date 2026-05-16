import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuditService } from './admin-audit.service';
import { EventsService } from '../events/events.service';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { Order } from '../domain/order.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { Role, EventStatus, OrderStatus } from '../domain/enums';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrderRefundService } from './order-refund.service';
import { AuthService } from '../auth/auth.service';
import { OrganizerProfilesService } from '../organizers/organizer-profiles.service';

describe('AdminController', () => {
  let controller: AdminController;
  let eventRepository: jest.Mocked<Repository<Event>>;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let adminAuditService: jest.Mocked<AdminAuditService>;
  let eventsService: jest.Mocked<EventsService>;
  let orderRefundService: jest.Mocked<OrderRefundService>;

  const mockAdminUser: CurrentUser = {
    id: 'admin-id',
    email: 'admin@example.com',
    roles: [Role.ADMIN],
  };

  beforeEach(async () => {
    const mockEventRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockOrderRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockAdminAuditService = {
      logAction: jest.fn(),
    };

    const mockEventsService = {
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const mockOrderRefundService = {
      refundPaidOrder: jest.fn(),
    };

    const mockAuthService = {
      forceSignOutUser: jest.fn(),
    };

    const mockOrganizerProfilesService = {
      serializeOrganizerProfile: jest.fn((p: OrganizerProfile) => ({
        id: p.id,
        verified: p.verified,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: AdminAuditService,
          useValue: mockAdminAuditService,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
        {
          provide: OrderRefundService,
          useValue: mockOrderRefundService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: OrganizerProfilesService,
          useValue: mockOrganizerProfilesService,
        },
        {
          provide: getRepositoryToken(TicketType),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(OrganizerProfile),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    eventRepository = module.get(getRepositoryToken(Event));
    orderRepository = module.get(getRepositoryToken(Order));
    userRepository = module.get(getRepositoryToken(User));
    adminAuditService = module.get(AdminAuditService);
    eventsService = module.get(EventsService);
    orderRefundService = module.get(OrderRefundService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPing', () => {
    it('should return ping message', () => {
      const result = controller.getPing(mockAdminUser);
      expect(result).toEqual({
        message: 'Admin endpoint is accessible',
        admin: mockAdminUser.email,
      });
    });
  });

  describe('approveEvent', () => {
    it('should approve an event and log audit', async () => {
      const mockEventBefore = {
        id: 'event-id',
        title: 'Test Event',
        status: EventStatus.PENDING_REVIEW,
      } as Event;

      const mockEventAfter = {
        id: 'event-id',
        title: 'Test Event',
        status: EventStatus.PUBLISHED,
      } as Event;

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Test Agent' },
      } as any;

      eventRepository.findOne.mockResolvedValue(mockEventBefore);
      eventsService.approve.mockResolvedValue(mockEventAfter);

      const result = await controller.approveEvent(
        'event-id',
        mockAdminUser,
        mockRequest,
      );

      expect(eventRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-id' },
      });
      expect(eventsService.approve).toHaveBeenCalledWith('event-id');
      expect(adminAuditService.logAction).toHaveBeenCalled();
      expect(result.message).toBe('Event approved and published successfully');
      expect(result.event.status).toBe(EventStatus.PUBLISHED);
    });

    it('should throw NotFoundException when event does not exist', async () => {
      eventRepository.findOne.mockResolvedValue(null);
      const mockRequest = {} as any;

      await expect(
        controller.approveEvent('non-existent-id', mockAdminUser, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectEvent', () => {
    it('should reject an event and log audit', async () => {
      const mockEventBefore = {
        id: 'event-id',
        title: 'Test Event',
        status: EventStatus.PENDING_REVIEW,
      } as Event;

      const mockEventAfter = {
        id: 'event-id',
        title: 'Test Event',
        status: EventStatus.REJECTED,
        metadata: { rejectionReason: 'Test reason' },
        organizerId: 'organizer-id',
        slug: 'test-event',
        startAt: new Date(),
        endAt: new Date(),
        type: 'VIRTUAL' as any,
        isPublic: true,
      } as unknown as Event;

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Test Agent' },
      } as any;

      eventRepository.findOne.mockResolvedValue(mockEventBefore);
      eventsService.reject.mockResolvedValue(mockEventAfter);

      const result = await controller.rejectEvent(
        'event-id',
        { reason: 'Test reason' },
        mockAdminUser,
        mockRequest,
      );

      expect(eventRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-id' },
      });
      expect(eventsService.reject).toHaveBeenCalledWith(
        'event-id',
        'Test reason',
      );
      expect(adminAuditService.logAction).toHaveBeenCalled();
      expect(result.message).toBe('Event rejected');
      expect(result.event.status).toBe(EventStatus.REJECTED);
      expect(result.event.rejectionReason).toBe('Test reason');
    });

    it('should throw NotFoundException when event does not exist', async () => {
      eventRepository.findOne.mockResolvedValue(null);
      const mockRequest = {} as any;

      await expect(
        controller.rejectEvent(
          'non-existent-id',
          { reason: 'Test' },
          mockAdminUser,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('refundOrder', () => {
    it('should refund an order and log audit', async () => {
      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Test Agent' },
      } as any;

      orderRefundService.refundPaidOrder.mockResolvedValue({
        order: {
          id: 'order-id',
          status: OrderStatus.REFUNDED,
          previousStatus: OrderStatus.PAID,
          refundAmountCents: 10000,
          originalAmountCents: 10000,
          currency: 'KES',
        },
      });

      const result = await controller.refundOrder(
        'order-id',
        { reason: 'Customer request' },
        mockAdminUser,
        mockRequest,
      );

      expect(orderRefundService.refundPaidOrder).toHaveBeenCalledWith('order-id', {
        reason: 'Customer request',
      });
      expect(adminAuditService.logAction).toHaveBeenCalled();
      expect(result.message).toBe('Order refunded successfully');
    });

    it('should throw NotFoundException when order does not exist', async () => {
      const mockRequest = {} as any;

      orderRefundService.refundPaidOrder.mockRejectedValue(new NotFoundException('Order not found'));

      await expect(
        controller.refundOrder(
          'non-existent-id',
          {},
          mockAdminUser,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is already refunded', async () => {
      const mockRequest = {} as any;

      orderRefundService.refundPaidOrder.mockRejectedValue(
        new BadRequestException('Order is already refunded'),
      );

      await expect(
        controller.refundOrder('order-id', {}, mockAdminUser, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUserRoles', () => {
    it('should update user roles and log audit', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        roles: [Role.ATTENDEE],
      } as User;

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Test Agent' },
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        roles: [Role.ORGANIZER],
      } as User);

      const result = await controller.updateUserRoles(
        'user-id',
        { roles: [Role.ORGANIZER] },
        mockAdminUser,
        mockRequest,
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(adminAuditService.logAction).toHaveBeenCalled();
      expect(result.message).toBe('User roles updated successfully');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockRequest = {} as any;

      await expect(
        controller.updateUserRoles(
          'non-existent-id',
          { roles: [Role.ADMIN] },
          mockAdminUser,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invalid roles are provided', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        roles: [Role.ATTENDEE],
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);
      const mockRequest = {} as any;

      await expect(
        controller.updateUserRoles(
          'user-id',
          { roles: ['INVALID_ROLE' as Role] },
          mockAdminUser,
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
