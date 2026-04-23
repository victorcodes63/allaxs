import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, EventStatus, OrderStatus } from '../domain/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { User } from '../users/entities/user.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminAction } from './decorators/admin-action.decorator';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { EventsService } from '../events/events.service';
import { RejectEventDto } from '../events/dto/reject-event.dto';
import type { Request } from 'express';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly adminAuditService: AdminAuditService,
    private readonly eventsService: EventsService,
  ) {}

  @Get('ping')
  @UseInterceptors(AdminAuditInterceptor)
  @AdminAction('ADMIN_PING', 'system')
  getPing(@GetUser() user: CurrentUser) {
    return {
      message: 'Admin endpoint is accessible',
      admin: user.email,
    };
  }

  @Get('events')
  @ApiOperation({ summary: 'List events with optional status filter' })
  @ApiResponse({
    status: 200,
    description: 'Events list',
    type: [Event],
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listEvents(
    @Query('status') status?: EventStatus,
    @Query('search') search?: string,
  ) {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('organizer.user', 'user')
      .orderBy('event.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(event.title ILIKE :search OR organizer.orgName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return queryBuilder.getMany();
  }

  @Post('events/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve event for publication' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Event approved and published',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        event: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string', enum: Object.values(EventStatus) },
            previousStatus: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async approveEvent(
    @Param('id') eventId: string,
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    // Get event before approval to capture previous status
    const eventBefore = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!eventBefore) {
      throw new NotFoundException('Event not found');
    }

    const previousStatus = eventBefore.status;

    // Use service to approve (changes status to PUBLISHED)
    const event = await this.eventsService.approve(eventId);

    // Log audit with additional metadata
    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'APPROVE_EVENT',
      resourceType: 'event',
      resourceId: event.id,
      metadata: {
        previousStatus,
        newStatus: event.status,
        eventTitle: event.title,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'Event approved and published successfully',
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        previousStatus,
      },
    };
  }

  @Post('events/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiBody({ type: RejectEventDto })
  @ApiResponse({
    status: 200,
    description: 'Event rejected',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        event: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string', enum: Object.values(EventStatus) },
            rejectionReason: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async rejectEvent(
    @Param('id') eventId: string,
    @Body() dto: RejectEventDto,
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    // Get event before rejection to capture previous status
    const eventBefore = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!eventBefore) {
      throw new NotFoundException('Event not found');
    }

    const previousStatus = eventBefore.status;

    // Use service to reject (changes status to REJECTED and stores reason in metadata)
    const event = await this.eventsService.reject(eventId, dto.reason);

    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'REJECT_EVENT',
      resourceType: 'event',
      resourceId: event.id,
      metadata: {
        previousStatus,
        newStatus: event.status,
        eventTitle: event.title,
        reason: dto.reason || null,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'Event rejected',
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        previousStatus,
        rejectionReason:
          event.metadata &&
          typeof event.metadata === 'object' &&
          'rejectionReason' in event.metadata
            ? (event.metadata.rejectionReason as string | undefined)
            : undefined,
      },
    };
  }

  @Post('orders/:id/refund')
  async refundOrder(
    @Param('id') orderId: string,
    @Body() body: { reason?: string; amountCents?: number },
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Order is already refunded');
    }

    const previousStatus = order.status;
    const refundAmount = body.amountCents || order.amountCents;

    // Update order status
    order.status = OrderStatus.REFUNDED;
    await this.orderRepository.save(order);

    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'REFUND_ORDER',
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        previousStatus,
        newStatus: order.status,
        refundAmountCents: refundAmount,
        originalAmountCents: order.amountCents,
        currency: order.currency,
        reason: body.reason || null,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'Order refunded successfully',
      order: {
        id: order.id,
        status: order.status,
        previousStatus,
        refundAmountCents: refundAmount,
      },
    };
  }

  @Patch('users/:id/roles')
  async updateUserRoles(
    @Param('id') userId: string,
    @Body() body: { roles: Role[] },
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Validate roles
    const validRoles = Object.values(Role);
    const invalidRoles = body.roles.filter((r) => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      throw new BadRequestException(
        `Invalid roles: ${invalidRoles.join(', ')}`,
      );
    }

    const oldRoles = [...targetUser.roles];
    targetUser.roles = body.roles;
    await this.userRepository.save(targetUser);

    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'UPDATE_USER_ROLES',
      resourceType: 'user',
      resourceId: targetUser.id,
      metadata: {
        oldRoles,
        newRoles: targetUser.roles,
        targetUserEmail: targetUser.email,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'User roles updated successfully',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        roles: targetUser.roles,
        previousRoles: oldRoles,
      },
    };
  }
}
