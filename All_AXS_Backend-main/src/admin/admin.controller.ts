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
import { Role, EventStatus, OrderStatus, UserStatus } from '../domain/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { Order } from '../domain/order.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminAction } from './decorators/admin-action.decorator';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { EventsService } from '../events/events.service';
import { AuthService } from '../auth/auth.service';
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
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
    private readonly adminAuditService: AdminAuditService,
    private readonly eventsService: EventsService,
    private readonly authService: AuthService,
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

  /**
   * Snapshot data for the admin landing dashboard. Aggregates moderation
   * queue counts, basic order stats, user role counts, the next pending
   * review queue items, and the most recent admin audit entries so the
   * frontend can render a single-screen overview without N round-trips.
   */
  @Get('overview')
  @ApiOperation({ summary: 'Admin landing-page overview snapshot' })
  @ApiResponse({ status: 200, description: 'Admin overview' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getOverview() {
    const eventStatuses = Object.values(EventStatus);
    const trendDays = 14;
    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - (trendDays - 1));

    const [
      eventStatusRows,
      orderStatusRows,
      paidOrderTotalsRow,
      refundedOrderTotalsRow,
      pendingReviewRows,
      recentActivityRows,
      submissionTrendRows,
      paidTrendRows,
      refundedTrendRows,
      adminCount,
      organizerCount,
      attendeeCount,
      totalUsers,
    ] = await Promise.all([
      this.eventRepository
        .createQueryBuilder('event')
        .select('event.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('event.status')
        .getRawMany<{ status: EventStatus; count: number }>(),
      this.orderRepository
        .createQueryBuilder('orders')
        .select('orders.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('orders.status')
        .getRawMany<{ status: OrderStatus; count: number }>(),
      this.orderRepository
        .createQueryBuilder('orders')
        .select('COALESCE(SUM(orders.amountCents), 0)::bigint', 'grossCents')
        .addSelect('COALESCE(SUM(orders.feesCents), 0)::bigint', 'feesCents')
        .addSelect('COUNT(*)::int', 'count')
        .where('orders.status = :paid', { paid: OrderStatus.PAID })
        .getRawOne<{
          grossCents: string | null;
          feesCents: string | null;
          count: number;
        }>(),
      this.orderRepository
        .createQueryBuilder('orders')
        .select('COALESCE(SUM(orders.amountCents), 0)::bigint', 'grossCents')
        .addSelect('COUNT(*)::int', 'count')
        .where('orders.status = :refunded', {
          refunded: OrderStatus.REFUNDED,
        })
        .getRawOne<{
          grossCents: string | null;
          count: number;
        }>(),
      this.eventRepository
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.organizer', 'organizer')
        .leftJoinAndSelect('organizer.user', 'user')
        .where('event.status = :status', {
          status: EventStatus.PENDING_REVIEW,
        })
        // Oldest *submission* first so the queue surfaces events that
        // have been waiting longest — not events that were drafted long
        // ago but only submitted today. Uses the physical column name.
        .orderBy(
          'COALESCE(event.submitted_at, event."createdAt")',
          'ASC',
        )
        .limit(5)
        .getMany(),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.adminUser', 'admin')
        .orderBy('audit.createdAt', 'DESC')
        .limit(8)
        .getMany(),
      // Real "submitted for review" trend. Falls back to createdAt only
      // for events that pre-date the submitted_at column (backfilled in
      // 1762960000000-AddEventSubmittedAt) so the chart doesn't lose
      // historic context.
      //
      // Note: raw SQL references the physical column name `submitted_at`
      // (snake_case) — TypeORM's `alias.property` shorthand only resolves
      // outside of function calls, so we can't write `event.submittedAt`
      // inside DATE_TRUNC/COALESCE expressions.
      this.eventRepository
        .createQueryBuilder('event')
        .select(
          `TO_CHAR(DATE_TRUNC('day', COALESCE(event.submitted_at, event."createdAt")), 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('COUNT(*)::int', 'count')
        .where(
          'COALESCE(event.submitted_at, event."createdAt") >= :trendStart',
          { trendStart },
        )
        .andWhere('event.status <> :draftStatus', {
          draftStatus: EventStatus.DRAFT,
        })
        .groupBy(
          `DATE_TRUNC('day', COALESCE(event.submitted_at, event."createdAt"))`,
        )
        .orderBy(
          `DATE_TRUNC('day', COALESCE(event.submitted_at, event."createdAt"))`,
          'ASC',
        )
        .getRawMany<{ date: string; count: number }>(),
      // Paid sparkline — daily count + gross cents over the trend window.
      this.orderRepository
        .createQueryBuilder('orders')
        .select(
          `TO_CHAR(DATE_TRUNC('day', orders."createdAt"), 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('COUNT(*)::int', 'count')
        .addSelect(
          'COALESCE(SUM(orders."amountCents"), 0)::bigint',
          'grossCents',
        )
        .where('orders.status = :paid', { paid: OrderStatus.PAID })
        .andWhere('orders."createdAt" >= :trendStart', { trendStart })
        .groupBy(`DATE_TRUNC('day', orders."createdAt")`)
        .orderBy(`DATE_TRUNC('day', orders."createdAt")`, 'ASC')
        .getRawMany<{ date: string; count: number; grossCents: string }>(),
      // Refunded sparkline — same shape so the frontend can render both
      // KPI cards from a single helper.
      this.orderRepository
        .createQueryBuilder('orders')
        .select(
          `TO_CHAR(DATE_TRUNC('day', orders."createdAt"), 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('COUNT(*)::int', 'count')
        .addSelect(
          'COALESCE(SUM(orders."amountCents"), 0)::bigint',
          'grossCents',
        )
        .where('orders.status = :refunded', {
          refunded: OrderStatus.REFUNDED,
        })
        .andWhere('orders."createdAt" >= :trendStart', { trendStart })
        .groupBy(`DATE_TRUNC('day', orders."createdAt")`)
        .orderBy(`DATE_TRUNC('day', orders."createdAt")`, 'ASC')
        .getRawMany<{ date: string; count: number; grossCents: string }>(),
      this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: Role.ADMIN })
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: Role.ORGANIZER })
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: Role.ATTENDEE })
        .getCount(),
      this.userRepository.count(),
    ]);

    const eventCounts: Record<EventStatus, number> = eventStatuses.reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<EventStatus, number>,
    );
    for (const row of eventStatusRows) {
      eventCounts[row.status] = Number(row.count);
    }

    const orderCounts: Record<string, number> = {};
    for (const row of orderStatusRows) {
      orderCounts[row.status] = Number(row.count);
    }

    const grossCents = Number(paidOrderTotalsRow?.grossCents ?? 0);
    const feesCents = Number(paidOrderTotalsRow?.feesCents ?? 0);
    const paidOrders = Number(paidOrderTotalsRow?.count ?? 0);
    const refundedGrossCents = Number(refundedOrderTotalsRow?.grossCents ?? 0);
    const refundedOrders = Number(refundedOrderTotalsRow?.count ?? 0);
    const submissionTrendMap = new Map<string, number>();
    for (const row of submissionTrendRows) {
      submissionTrendMap.set(row.date, Number(row.count));
    }
    const submissionTrend = Array.from({ length: trendDays }, (_, index) => {
      const date = new Date(trendStart);
      date.setUTCDate(trendStart.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: submissionTrendMap.get(key) ?? 0 };
    });

    type DailyRevenueRow = {
      date: string;
      count: number;
      grossCents: string;
    };
    const buildOrderTrend = (rows: ReadonlyArray<DailyRevenueRow>) => {
      const byDate = new Map<string, { count: number; grossCents: number }>();
      for (const row of rows) {
        byDate.set(row.date, {
          count: Number(row.count),
          grossCents: Number(row.grossCents ?? 0),
        });
      }
      return Array.from({ length: trendDays }, (_, index) => {
        const date = new Date(trendStart);
        date.setUTCDate(trendStart.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        const slot = byDate.get(key) ?? { count: 0, grossCents: 0 };
        return { date: key, count: slot.count, grossCents: slot.grossCents };
      });
    };
    const paidTrend = buildOrderTrend(paidTrendRows);
    const refundedTrend = buildOrderTrend(refundedTrendRows);

    return {
      generatedAt: new Date().toISOString(),
      events: {
        byStatus: eventCounts,
        submissionTrend,
        pendingReviewQueue: pendingReviewRows.map((event) => ({
          id: event.id,
          title: event.title,
          slug: event.slug,
          startAt: event.startAt,
          endAt: event.endAt,
          // Use the real submission timestamp, falling back to createdAt
          // for any historic rows that pre-date the column.
          submittedAt: event.submittedAt ?? event.createdAt,
          bannerUrl: event.bannerUrl ?? null,
          organizer: {
            id: event.organizer?.id,
            orgName: event.organizer?.orgName ?? 'Unknown organizer',
            email: event.organizer?.user?.email ?? null,
            name: event.organizer?.user?.name ?? null,
          },
        })),
      },
      orders: {
        byStatus: orderCounts,
        paid: {
          count: paidOrders,
          grossCents,
          feesCents,
          netCents: Math.max(0, grossCents - feesCents),
        },
        refunded: {
          count: refundedOrders,
          grossCents: refundedGrossCents,
        },
        // 14-day daily sparklines so the admin overview KPI cards can
        // show a trend strip alongside the headline number. Both arrays
        // have exactly `trendDays` entries, zero-filled for empty days.
        paidTrend,
        refundedTrend,
      },
      users: {
        total: totalUsers,
        admins: adminCount,
        organizers: organizerCount,
        attendees: attendeeCount,
      },
      recentActivity: recentActivityRows.map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        status: row.status,
        createdAt: row.createdAt,
        admin: row.adminUser
          ? {
              id: row.adminUser.id,
              email: row.adminUser.email,
              name: row.adminUser.name ?? null,
            }
          : null,
        metadata: row.metadata ?? null,
      })),
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

    const rows = await queryBuilder.getMany();
    return rows.map((event) => this.toAdminEventListRow(event));
  }

  /**
   * Admin-scoped event detail. Includes the organiser, the organiser's user
   * record (so we can show contact email), and ticket tiers — none of which
   * are joined by the public `GET /events/:id` endpoint.
   */
  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single event with full admin context' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event detail' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventDetail(@Param('id') id: string) {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('organizer.user', 'user')
      .where('event.id = :id', { id })
      .getOne();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const ticketTypes = await this.ticketTypeRepository.find({
      where: { eventId: event.id },
      order: { createdAt: 'ASC' },
    });

    return this.toAdminEventDetail(event, ticketTypes);
  }

  /**
   * Per-event order rollup. Powers the revenue strip on the admin event
   * detail page so admins can see at a glance how the sale is performing
   * without bouncing to a separate analytics view. Currency is taken from
   * the most common order currency, falling back to the first ticket
   * tier's currency or KES when no orders exist yet.
   */
  @Get('events/:id/orders-summary')
  @ApiOperation({ summary: 'Orders + revenue rollup for a single event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Orders summary' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventOrdersSummary(@Param('id') eventId: string) {
    const eventExists = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.id = :id', { id: eventId })
      .getCount();

    if (!eventExists) {
      throw new NotFoundException('Event not found');
    }

    const [byStatusRows, paidRow, refundedRow, primaryCurrencyRow] =
      await Promise.all([
        this.orderRepository
          .createQueryBuilder('orders')
          .select('orders.status', 'status')
          .addSelect('COUNT(*)::int', 'count')
          .where('orders.eventId = :eventId', { eventId })
          .groupBy('orders.status')
          .getRawMany<{ status: OrderStatus; count: number }>(),
        this.orderRepository
          .createQueryBuilder('orders')
          .select('COALESCE(SUM(orders.amountCents), 0)::bigint', 'grossCents')
          .addSelect('COALESCE(SUM(orders.feesCents), 0)::bigint', 'feesCents')
          .addSelect('COUNT(*)::int', 'count')
          .where('orders.eventId = :eventId', { eventId })
          .andWhere('orders.status = :paid', { paid: OrderStatus.PAID })
          .getRawOne<{
            grossCents: string | null;
            feesCents: string | null;
            count: number;
          }>(),
        this.orderRepository
          .createQueryBuilder('orders')
          .select('COALESCE(SUM(orders.amountCents), 0)::bigint', 'grossCents')
          .addSelect('COUNT(*)::int', 'count')
          .where('orders.eventId = :eventId', { eventId })
          .andWhere('orders.status = :refunded', {
            refunded: OrderStatus.REFUNDED,
          })
          .getRawOne<{ grossCents: string | null; count: number }>(),
        this.orderRepository
          .createQueryBuilder('orders')
          .select('orders.currency', 'currency')
          .addSelect('COUNT(*)::int', 'count')
          .where('orders.eventId = :eventId', { eventId })
          .groupBy('orders.currency')
          .orderBy('count', 'DESC')
          .limit(1)
          .getRawOne<{ currency: string; count: number }>(),
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      byStatus[row.status] = Number(row.count);
    }

    let currency = primaryCurrencyRow?.currency ?? null;
    if (!currency) {
      const tier = await this.ticketTypeRepository.findOne({
        where: { eventId },
        order: { createdAt: 'ASC' },
      });
      currency = tier?.currency ?? 'KES';
    }

    const grossCents = Number(paidRow?.grossCents ?? 0);
    const feesCents = Number(paidRow?.feesCents ?? 0);
    const refundGrossCents = Number(refundedRow?.grossCents ?? 0);

    return {
      eventId,
      currency,
      byStatus,
      paid: {
        count: Number(paidRow?.count ?? 0),
        grossCents,
        feesCents,
        netCents: Math.max(0, grossCents - feesCents),
      },
      refunded: {
        count: Number(refundedRow?.count ?? 0),
        grossCents: refundGrossCents,
      },
    };
  }

  /**
   * Moderation / admin-action history for a single event. Reads
   * admin_audit_logs filtered by resourceType + resourceId so we can
   * render an audit trail on the admin event detail page (who approved,
   * rejected, refunded — with timestamps and metadata).
   */
  @Get('events/:id/audit')
  @ApiOperation({ summary: 'Audit history for a single event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Audit history' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEventAuditHistory(
    @Param('id') eventId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit ?? '20', 10) || 20, 1),
      100,
    );

    const rows = await this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.adminUser', 'admin')
      .where('audit.resourceType = :type', { type: 'event' })
      .andWhere('audit.resourceId = :id', { id: eventId })
      .orderBy('audit.createdAt', 'DESC')
      .limit(parsedLimit)
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      status: row.status,
      createdAt: row.createdAt,
      metadata: row.metadata ?? null,
      admin: row.adminUser
        ? {
            id: row.adminUser.id,
            email: row.adminUser.email,
            name: row.adminUser.name ?? null,
          }
        : null,
    }));
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

  /**
   * Paginated orders list for the admin /admin/orders view. Supports
   * filtering by status, event, organiser, free-text search on reference
   * or buyer email, and a `from..to` createdAt range. Pagination is
   * offset-based — small dataset, simple wins.
   *
   * NOTE: The `orders` table currently carries two physical columns for
   * the event/user relations (`eventId`/`event_id`, `userId`/`user_id`)
   * because of a partial schema migration. Existing rows populate the
   * camelCase columns; TypeORM's `@JoinColumn` metadata points at the
   * snake_case ones. To avoid silently dropping orders with NULL
   * `event_id`, the joins below use explicit ON conditions against the
   * populated columns. Same trick for the `order_items` count, which is
   * resolved via a raw SQL query.
   */
  @Get('orders')
  @ApiOperation({ summary: 'List orders with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated orders' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listOrders(
    @Query('status') status?: OrderStatus,
    @Query('eventId') eventId?: string,
    @Query('organizerId') organizerId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit ?? '25', 10) || 25, 1),
      100,
    );
    const parsedOffset = Math.max(
      Number.parseInt(offset ?? '0', 10) || 0,
      0,
    );

    const qb = this.orderRepository
      .createQueryBuilder('orders')
      .innerJoinAndSelect('orders.event', 'event')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .orderBy('orders.createdAt', 'DESC');

    if (status) {
      qb.andWhere('orders.status = :status', { status });
    }
    if (eventId) {
      qb.andWhere('orders.eventId = :eventId', { eventId });
    }
    if (organizerId) {
      qb.andWhere('organizer.id = :organizerId', { organizerId });
    }
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(orders.reference ILIKE :term OR orders.email ILIKE :term OR orders.id::text ILIKE :term)',
        { term },
      );
    }
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        qb.andWhere('orders.createdAt >= :from', { from: fromDate });
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        qb.andWhere('orders.createdAt <= :to', { to: toDate });
      }
    }

    qb.skip(parsedOffset).take(parsedLimit);

    const [rows, total] = await qb.getManyAndCount();

    const orderIds = rows.map((row) => row.id);
    const itemCountRows: Array<{ order_id: string; count: string }> =
      orderIds.length > 0
        ? await this.orderRepository.manager.query(
            `SELECT order_id, COUNT(*)::int AS count FROM order_items WHERE order_id = ANY($1::uuid[]) GROUP BY order_id`,
            [orderIds],
          )
        : [];
    const itemCountMap = new Map<string, number>();
    for (const row of itemCountRows) {
      itemCountMap.set(row.order_id, Number(row.count));
    }

    return {
      items: rows.map((order) => {
        const orderEvent = (order as Order & { event?: Event }).event;
        return {
          id: order.id,
          reference: order.reference ?? null,
          status: order.status,
          amountCents: order.amountCents,
          feesCents: order.feesCents,
          currency: order.currency,
          email: order.email,
          phone: order.phone ?? null,
          itemCount: itemCountMap.get(order.id) ?? 0,
          createdAt: order.createdAt,
          event: orderEvent
            ? {
                id: orderEvent.id,
                title: orderEvent.title,
                slug: orderEvent.slug ?? null,
                organizer: orderEvent.organizer
                  ? {
                      id: orderEvent.organizer.id,
                      orgName: orderEvent.organizer.orgName,
                    }
                  : null,
              }
            : null,
        };
      }),
      total,
      limit: parsedLimit,
      offset: parsedOffset,
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

  /**
   * Paginated user directory for the admin /admin/users view. Supports
   * free-text search on email/name, role + status filters, and offset
   * pagination. Returns lightweight DTOs (no password hashes, no
   * organiser relation) — relation joins are avoided because the
   * `organizer_profiles` and `users` tables both have duplicate
   * camelCase/snake_case columns from a partial migration (see TODO).
   */
  @Get('users')
  @ApiOperation({ summary: 'List users with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated users' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listUsers(
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('status') status?: UserStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit ?? '25', 10) || 25, 1),
      100,
    );
    const parsedOffset = Math.max(
      Number.parseInt(offset ?? '0', 10) || 0,
      0,
    );

    const qb = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(user.email ILIKE :term OR user.name ILIKE :term OR user.id::text ILIKE :term)', {
        term,
      });
    }
    if (role && Object.values(Role).includes(role)) {
      qb.andWhere(':role = ANY(user.roles)', { role });
    }
    if (status && Object.values(UserStatus).includes(status)) {
      qb.andWhere('user.status = :status', { status });
    }

    qb.skip(parsedOffset).take(parsedLimit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        phone: row.phone ?? null,
        roles: row.roles,
        status: row.status,
        createdAt: row.createdAt,
      })),
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  }

  /**
   * Support-triage detail for a single account. Returns the user record
   * plus the related admin context that was previously scattered across
   * list/dialog views: organiser profile, hosted events, orders placed,
   * and audit trail.
   *
   * Schema note: this used to need explicit camelCase column references
   * to work around the duplicate FK columns on `orders` /
   * `organizer_profiles`. After `UnifyForeignKeyColumns1762950000000`
   * unified everything on snake_case, the standard property-name joins
   * (`orders.event`, `orders.eventId`, etc.) work correctly.
   */
  @Get('users/:id')
  @ApiOperation({ summary: 'Get a single user with admin support context' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User detail' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDetail(@Param('id') userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const organizerProfile = await this.organizerProfileRepository
      .createQueryBuilder('organizer')
      .where('organizer.userId = :userId', { userId })
      .getOne();

    const [
      hostedEvents,
      hostedStatusRows,
      orders,
      orderStatusRows,
      orderTotalsRow,
      auditRows,
    ] = await Promise.all([
      organizerProfile
        ? this.eventRepository
            .createQueryBuilder('event')
            .where('event.organizer_id = :organizerId', {
              organizerId: organizerProfile.id,
            })
            .orderBy('event.createdAt', 'DESC')
            .limit(8)
            .getMany()
        : Promise.resolve([] as Event[]),
      organizerProfile
        ? this.eventRepository
            .createQueryBuilder('event')
            .select('event.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .where('event.organizer_id = :organizerId', {
              organizerId: organizerProfile.id,
            })
            .groupBy('event.status')
            .getRawMany<{ status: EventStatus; count: number }>()
        : Promise.resolve([] as Array<{ status: EventStatus; count: number }>),
      this.orderRepository
        .createQueryBuilder('orders')
        .innerJoinAndSelect('orders.event', 'event')
        .leftJoinAndSelect('event.organizer', 'organizer')
        .where('(orders.userId = :userId OR orders.email = :email)', {
          userId,
          email: user.email,
        })
        .orderBy('orders.createdAt', 'DESC')
        .limit(8)
        .getMany(),
      this.orderRepository
        .createQueryBuilder('orders')
        .select('orders.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .where('(orders.userId = :userId OR orders.email = :email)', {
          userId,
          email: user.email,
        })
        .groupBy('orders.status')
        .getRawMany<{ status: OrderStatus; count: number }>(),
      this.orderRepository
        .createQueryBuilder('orders')
        .select('COUNT(*)::int', 'count')
        .addSelect('COALESCE(SUM(orders.amountCents), 0)::bigint', 'grossCents')
        .addSelect('COALESCE(SUM(orders.feesCents), 0)::bigint', 'feesCents')
        .where('(orders.userId = :userId OR orders.email = :email)', {
          userId,
          email: user.email,
        })
        .getRawOne<{
          count: number;
          grossCents: string | null;
          feesCents: string | null;
        }>(),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.adminUser', 'admin')
        .where('audit.resourceType = :type', { type: 'user' })
        .andWhere('audit.resourceId = :id', { id: userId })
        .orderBy('audit.createdAt', 'DESC')
        .limit(20)
        .getMany(),
    ]);

    const eventIds = hostedEvents.map((event) => event.id);
    const ticketTypeCountRows: Array<{ event_id: string; count: string }> =
      eventIds.length > 0
        ? await this.ticketTypeRepository.manager.query(
            `SELECT event_id, COUNT(*)::int AS count FROM ticket_types WHERE event_id = ANY($1::uuid[]) GROUP BY event_id`,
            [eventIds],
          )
        : [];
    const ticketTypeCountMap = new Map<string, number>();
    for (const row of ticketTypeCountRows) {
      ticketTypeCountMap.set(row.event_id, Number(row.count));
    }

    const orderIds = orders.map((order) => order.id);
    const itemCountRows: Array<{ order_id: string; count: string }> =
      orderIds.length > 0
        ? await this.orderRepository.manager.query(
            `SELECT order_id, COUNT(*)::int AS count FROM order_items WHERE order_id = ANY($1::uuid[]) GROUP BY order_id`,
            [orderIds],
          )
        : [];
    const itemCountMap = new Map<string, number>();
    for (const row of itemCountRows) {
      itemCountMap.set(row.order_id, Number(row.count));
    }

    const eventStatusCounts: Record<string, number> = {};
    for (const row of hostedStatusRows) {
      eventStatusCounts[row.status] = Number(row.count);
    }

    const orderStatusCounts: Record<string, number> = {};
    for (const row of orderStatusRows) {
      orderStatusCounts[row.status] = Number(row.count);
    }

    const grossCents = Number(orderTotalsRow?.grossCents ?? 0);
    const feesCents = Number(orderTotalsRow?.feesCents ?? 0);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        phone: user.phone ?? null,
        roles: user.roles,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      organizerProfile: organizerProfile
        ? {
            id: organizerProfile.id,
            orgName: organizerProfile.orgName,
            legalName: organizerProfile.legalName ?? null,
            supportEmail: organizerProfile.supportEmail ?? null,
            supportPhone: organizerProfile.supportPhone ?? null,
            website: organizerProfile.website ?? null,
            verified: organizerProfile.verified,
            createdAt: organizerProfile.createdAt,
          }
        : null,
      hostedEvents: {
        byStatus: eventStatusCounts,
        items: hostedEvents.map((event) => ({
          id: event.id,
          title: event.title,
          slug: event.slug ?? null,
          status: event.status,
          type: event.type,
          startAt: event.startAt,
          endAt: event.endAt,
          bannerUrl: event.bannerUrl ?? null,
          venue: event.venue ?? null,
          city: event.city ?? null,
          country: event.country ?? null,
          ticketTypeCount: ticketTypeCountMap.get(event.id) ?? 0,
          createdAt: event.createdAt,
        })),
      },
      orders: {
        byStatus: orderStatusCounts,
        total: Number(orderTotalsRow?.count ?? 0),
        grossCents,
        feesCents,
        netCents: Math.max(0, grossCents - feesCents),
        items: orders.map((order) => {
          const orderEvent = (order as Order & { event?: Event }).event;
          return {
            id: order.id,
            reference: order.reference ?? null,
            status: order.status,
            amountCents: order.amountCents,
            feesCents: order.feesCents,
            currency: order.currency,
            email: order.email,
            phone: order.phone ?? null,
            itemCount: itemCountMap.get(order.id) ?? 0,
            createdAt: order.createdAt,
            event: orderEvent
              ? {
                  id: orderEvent.id,
                  title: orderEvent.title,
                  slug: orderEvent.slug ?? null,
                  organizer: orderEvent.organizer
                    ? {
                        id: orderEvent.organizer.id,
                        orgName: orderEvent.organizer.orgName,
                      }
                    : null,
                }
              : null,
          };
        }),
      },
      audit: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        status: row.status,
        createdAt: row.createdAt,
        metadata: row.metadata ?? null,
        admin: row.adminUser
          ? {
              id: row.adminUser.id,
              email: row.adminUser.email,
              name: row.adminUser.name ?? null,
            }
          : null,
      })),
    };
  }

  /**
   * Audit history for a single user. Same pattern as the per-event audit
   * endpoint: filter `admin_audit_logs` by `resourceType='user'` and the
   * user's id. Covers role updates, status changes, and any future
   * user-scoped admin actions.
   */
  @Get('users/:id/audit')
  @ApiOperation({ summary: 'Audit history for a single user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Audit history' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUserAuditHistory(
    @Param('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit ?? '20', 10) || 20, 1),
      100,
    );

    const rows = await this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.adminUser', 'admin')
      .where('audit.resourceType = :type', { type: 'user' })
      .andWhere('audit.resourceId = :id', { id: userId })
      .orderBy('audit.createdAt', 'DESC')
      .limit(parsedLimit)
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      status: row.status,
      createdAt: row.createdAt,
      metadata: row.metadata ?? null,
      admin: row.adminUser
        ? {
            id: row.adminUser.id,
            email: row.adminUser.email,
            name: row.adminUser.name ?? null,
          }
        : null,
    }));
  }

  /**
   * Toggle a user's active/suspended status. NOTE: the auth pipeline does
   * not currently re-check `user.status` on token issuance or refresh, so
   * a suspended user will retain access until they log out and try to
   * sign in again. Tracked as a follow-up in docs/ADMIN_TODO.md.
   */
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update a user status (active / suspended)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() body: { status: UserStatus },
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!body || !Object.values(UserStatus).includes(body.status)) {
      throw new BadRequestException(
        `Invalid status. Expected one of: ${Object.values(UserStatus).join(
          ', ',
        )}`,
      );
    }

    if (userId === user.id && body.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('You cannot suspend your own account.');
    }

    const previousStatus = targetUser.status;

    if (previousStatus === body.status) {
      return {
        message: 'User status unchanged',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          status: targetUser.status,
          previousStatus,
        },
      };
    }

    targetUser.status = body.status;
    await this.userRepository.save(targetUser);

    // Suspending should also kill every active session immediately.
    // JwtStrategy already blocks SUSPENDED on the next request, but we
    // also revoke refresh tokens so the user can't ride the 7-day chain
    // back into a fresh access token.
    let revokedSessions = 0;
    if (body.status === UserStatus.SUSPENDED) {
      revokedSessions = await this.authService.forceSignOutUser(
        targetUser.id,
        'Account suspended by admin',
      );
    }

    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'UPDATE_USER_STATUS',
      resourceType: 'user',
      resourceId: targetUser.id,
      metadata: {
        previousStatus,
        newStatus: targetUser.status,
        targetUserEmail: targetUser.email,
        revokedSessions,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)
          ?.split(',')[0]
          ?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'User status updated successfully',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        status: targetUser.status,
        previousStatus,
      },
      revokedSessions,
    };
  }

  /**
   * Revoke every active refresh-token session for a user without
   * touching their account status. Useful when an admin wants to force
   * a re-login (e.g. suspected credential leak) on an ACTIVE account.
   * The JWT access token (15 minutes) will continue to work until next
   * validation; the refresh chain is killed immediately.
   */
  @Post('users/:id/force-logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force sign-out a user from every device' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Sessions revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forceLogoutUser(
    @Param('id') userId: string,
    @Body() body: { reason?: string } | undefined,
    @GetUser() user: CurrentUser,
    @Req() request: Request,
  ) {
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (userId === user.id) {
      throw new BadRequestException(
        'Use the standard sign-out flow for your own account.',
      );
    }

    const reason =
      body?.reason && body.reason.trim().length > 0
        ? body.reason.trim()
        : 'Forced sign-out by admin';

    const revokedSessions = await this.authService.forceSignOutUser(
      targetUser.id,
      reason,
    );

    await this.adminAuditService.logAction({
      adminUserId: user.id,
      action: 'FORCE_USER_LOGOUT',
      resourceType: 'user',
      resourceId: targetUser.id,
      metadata: {
        targetUserEmail: targetUser.email,
        revokedSessions,
        reason,
      },
      ipAddress:
        request.ip ||
        (request.headers['x-forwarded-for'] as string)
          ?.split(',')[0]
          ?.trim() ||
        (request.headers['x-real-ip'] as string) ||
        null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    return {
      message: 'User sessions revoked',
      user: {
        id: targetUser.id,
        email: targetUser.email,
      },
      revokedSessions,
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

  private toAdminUserSafe(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      status: user.status,
      roles: user.roles,
    };
  }

  private toAdminOrganizerSafe(org: OrganizerProfile) {
    return {
      id: org.id,
      userId: org.userId,
      orgName: org.orgName,
      legalName: org.legalName ?? null,
      website: org.website ?? null,
      supportEmail: org.supportEmail,
      supportPhone: org.supportPhone ?? null,
      verified: org.verified,
      user: org.user ? this.toAdminUserSafe(org.user) : null,
    };
  }

  private toAdminEventListRow(event: Event) {
    return {
      id: event.id,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      title: event.title,
      slug: event.slug,
      description: event.description ?? null,
      bannerUrl: event.bannerUrl ?? null,
      venue: event.venue ?? null,
      city: event.city ?? null,
      country: event.country ?? null,
      startAt: event.startAt,
      endAt: event.endAt,
      type: event.type,
      status: event.status,
      submittedAt: event.submittedAt ?? null,
      category: event.category ?? null,
      isPublic: event.isPublic,
      metadata: event.metadata ?? null,
      organizerId: event.organizerId,
      organizer: this.toAdminOrganizerSafe(event.organizer),
    };
  }

  private toAdminTicketTypeSafe(t: TicketType) {
    return {
      id: t.id,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      eventId: t.eventId,
      name: t.name,
      description: t.description ?? null,
      priceCents: t.priceCents,
      currency: t.currency,
      quantityTotal: t.quantityTotal,
      quantitySold: t.quantitySold,
      minPerOrder: t.minPerOrder,
      maxPerOrder: t.maxPerOrder ?? null,
      salesStart: t.salesStart ?? null,
      salesEnd: t.salesEnd ?? null,
      status: t.status,
      allowInstallments: t.allowInstallments,
      installmentConfig: t.installmentConfig ?? null,
    };
  }

  private toAdminEventDetail(event: Event, ticketTypes: TicketType[]) {
    return {
      id: event.id,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      title: event.title,
      slug: event.slug,
      description: event.description,
      bannerUrl: event.bannerUrl ?? null,
      venue: event.venue,
      city: event.city,
      country: event.country,
      startAt: event.startAt,
      endAt: event.endAt,
      type: event.type,
      status: event.status,
      submittedAt: event.submittedAt ?? null,
      category: event.category,
      isPublic: event.isPublic,
      metadata: event.metadata ?? null,
      organizerId: event.organizerId,
      organizer: this.toAdminOrganizerSafe(event.organizer),
      ticketTypes: ticketTypes.map((t) => this.toAdminTicketTypeSafe(t)),
    };
  }
}
