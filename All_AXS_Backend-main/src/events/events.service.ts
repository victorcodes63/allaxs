import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Event } from './entities/event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { Coupon } from './entities/coupon.entity';
import {
  EventStatus,
  EventType,
  OrderStatus,
  Role,
  TicketTypeStatus,
} from 'src/domain/enums';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AdminAuditLog } from 'src/admin/entities/admin-audit-log.entity';
import { EmailService } from 'src/auth/services/email.service';
import { Order } from 'src/domain/order.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  /**
   * Record an admin mutation against an event. Best-effort: failures are
   * logged but never propagate, so audit hiccups can't block legitimate
   * admin edits. Mirrors the shape used by AdminController via
   * `AdminAuditService` so all admin actions land in the same table.
   */
  private async recordAdminAction(
    actorId: string,
    action: string,
    eventId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.adminAuditLogRepository.save(
        this.adminAuditLogRepository.create({
          adminUserId: actorId,
          action,
          resourceType: 'event',
          resourceId: eventId,
          metadata,
          status: 'SUCCESS',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to record admin audit entry for ${action} on event ${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Generate a URL-safe slug from a title
   */
  private slugify(title: string): string {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Fallback if slug is empty (should not happen with validation, but safety first)
    return slug || 'event';
  }

  /**
   * Generate a unique slug by appending a suffix if needed
   */
  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const queryBuilder = this.eventRepository
        .createQueryBuilder('event')
        .where('event.slug = :slug', { slug });

      if (excludeId) {
        queryBuilder.andWhere('event.id != :excludeId', { excludeId });
      }

      const existing = await queryBuilder.getOne();

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Validate event dates and venue requirements
   */
  private validateEventData(data: {
    startsAt: Date;
    endsAt: Date;
    type: EventType;
    venue?: string;
  }): void {
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    if (
      (data.type === EventType.IN_PERSON || data.type === EventType.HYBRID) &&
      !data.venue
    ) {
      throw new BadRequestException(
        'venue is required for in_person and hybrid events',
      );
    }
  }

  /**
   * Check if user owns the event
   */
  /**
   * Loads the event and asserts the user has permission to mutate it.
   *
   * Admins are exempt from the ownership check: pass the JWT's roles in via
   * `userRoles` to enable the bypass. This is how the admin event editor
   * (/admin/events/[id]/edit) reuses the same controllers as organisers.
   * If `userRoles` is omitted we keep the historic strict-ownership
   * behaviour, so any legacy callers that don't yet thread roles through
   * still get the safer default.
   */
  async ensureOwnership(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .where('event.id = :eventId', { eventId })
      .getOne();

    if (!event || !event.organizer) {
      throw new NotFoundException('Event not found');
    }

    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;
    if (!isAdmin && event.organizer.userId !== userId) {
      throw new ForbiddenException('You do not own this event');
    }

    return event;
  }

  /**
   * Check if event can be edited (only draft or pending status)
   */
  private canEdit(status: EventStatus): boolean {
    return (
      status === EventStatus.DRAFT ||
      status === EventStatus.PENDING_REVIEW ||
      status === EventStatus.REJECTED
    );
  }

  private async notifyEventSubmittedForReview(event: Event): Promise<void> {
    const admins = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: Role.ADMIN })
      .getMany();

    const organizerEmail = event.organizer?.user?.email;
    const organizerName = event.organizer?.user?.name ?? null;
    const orgName = event.organizer?.orgName ?? null;
    const emailBase = {
      eventTitle: event.title,
      eventId: event.id,
      orgName,
      venue: event.venue ?? null,
      startAt: event.startAt,
    };

    const tasks: Promise<unknown>[] = admins.flatMap((admin) => [
      this.notificationsService.createInAppNotification({
        to: admin.email,
        title: 'Event submitted for review',
        body: `${event.title} is waiting in the moderation queue.`,
        link: '/admin/moderation',
        category: 'hosting',
        template: 'event_submitted_for_review',
        payload: {
          eventId: event.id,
          eventTitle: event.title,
          eventStatus: EventStatus.PENDING_REVIEW,
        },
      }),
      this.emailService.sendEventSubmittedForReviewEmail({
        to: admin.email,
        recipientName: admin.name,
        audience: 'admin',
        ...emailBase,
      }),
    ]);

    if (organizerEmail) {
      tasks.push(
        this.emailService.sendEventSubmittedForReviewEmail({
          to: organizerEmail,
          recipientName: organizerName,
          audience: 'organizer',
          ...emailBase,
        }),
      );
    }

    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Event submitted notification failed for ${event.id}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    }
  }

  private async notifyOrganizerReviewDecision(
    eventId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['organizer', 'organizer.user'],
    });

    const organizerEmail = event?.organizer?.user?.email;
    if (!event || !organizerEmail) return;

    const approved = decision === 'approved';
    await this.notificationsService.createInAppNotification({
      to: organizerEmail,
      title: approved ? 'Event approved — publish when ready' : 'Event needs changes',
      body: approved
        ? `${event.title} has been approved by admins. Publish it from the organizer dashboard when you're ready to go live.`
        : reason
          ? `${event.title} was rejected: ${reason}`
          : `${event.title} was rejected. Open the editor to update and resubmit.`,
      link: approved
        ? `/organizer/events/${event.id}/edit`
        : `/organizer/events/${event.id}/edit`,
      category: 'hosting',
      template: approved ? 'event_review_approved' : 'event_review_rejected',
      payload: {
        eventId: event.id,
        eventTitle: event.title,
        eventStatus: event.status,
        rejectionReason: reason,
      },
    });
  }

  /**
   * In-app notification for organiser self-serve publish/unpublish actions.
   * Best-effort — we never fail the underlying state transition because the
   * notification couldn't be persisted.
   */
  private async notifyOrganizerPublishAction(
    eventId: string,
    action: 'published' | 'unpublished',
  ): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['organizer', 'organizer.user'],
    });

    const organizerEmail = event?.organizer?.user?.email;
    if (!event || !organizerEmail) return;

    const published = action === 'published';
    try {
      await this.notificationsService.createInAppNotification({
        to: organizerEmail,
        title: published ? 'Event published' : 'Event unpublished',
        body: published
          ? `${event.title} is now live on All AXS. Share the link to start selling tickets.`
          : `${event.title} has been unpublished and archived. Buyers can no longer purchase tickets.`,
        link: published
          ? `/events/${event.slug}`
          : `/organizer/events/${event.id}/edit`,
        category: 'hosting',
        template: published ? 'event_published' : 'event_unpublished',
        payload: {
          eventId: event.id,
          eventTitle: event.title,
          eventStatus: event.status,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify organiser for ${action} on event ${event.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Create a new event with idempotency support
   */
  async create(
    userId: string,
    dto: CreateEventDto,
    idempotencyKey?: string,
  ): Promise<Event> {
    // Get organizer profile for user
    const organizerProfile = await this.organizerProfileRepository.findOne({
      where: { userId },
    });

    if (!organizerProfile) {
      throw new ForbiddenException(
        'Organizer profile not found. Please complete organizer onboarding first.',
      );
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.eventRepository
        .createQueryBuilder('event')
        .where('event.organizer_id = :organizerId', {
          organizerId: organizerProfile.id,
        })
        .andWhere("event.metadata->>'idemKey' = :idemKey", {
          idemKey: idempotencyKey,
        })
        .getOne();

      if (existing) {
        return existing;
      }
    }

    // Validate dates and venue
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateEventData({
      startsAt,
      endsAt,
      type: dto.type,
      venue: dto.venue,
    });

    // Generate slug
    const baseSlug = this.slugify(dto.title);
    const slug = await this.generateUniqueSlug(baseSlug);

    // Create event with organizer relation (this will set organizer_id)
    // bannerUrl is excluded from DTO to prevent direct writes - use upload endpoints instead
    const event = this.eventRepository.create({
      organizer: organizerProfile,
      title: dto.title,
      description: dto.description,
      // bannerUrl: dto.bannerUrl, // Excluded - use upload endpoints
      type: dto.type,
      venue: dto.venue,
      startAt: startsAt,
      endAt: endsAt,
      status: EventStatus.DRAFT,
      slug,
      metadata: idempotencyKey ? { idemKey: idempotencyKey } : undefined,
    });

    const savedEvent = await this.eventRepository.save(event);

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Find event by ID with access control
   */
  async findById(
    eventId: string,
    userId?: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .where('event.id = :eventId', { eventId })
      .getOne();

    if (!event || !event.organizer) {
      throw new NotFoundException('Event not found');
    }

    // Public access: only published events
    if (!userId || !userRoles) {
      if (event.status !== EventStatus.PUBLISHED) {
        throw new NotFoundException('Event not found');
      }
      return event;
    }

    // Owner or Admin can access any status
    const isOwner = event.organizer.userId === userId;
    const isAdmin = userRoles.includes(Role.ADMIN);

    if (isOwner || isAdmin) {
      return event;
    }

    // Public users can only see published events
    if (event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  /**
   * Update an event (only if draft or pending)
   */
  async update(
    eventId: string,
    userId: string,
    dto: UpdateEventDto,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);
    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;

    // Admins can edit events in any status (including PUBLISHED) so they can
    // correct typos, change venues last-minute, etc. Organisers remain
    // limited to the draft/pending/rejected window.
    if (!isAdmin && !this.canEdit(event.status)) {
      throw new BadRequestException(
        'Event can only be edited when status is draft or pending',
      );
    }

    // Validate dates if provided
    if (dto.startsAt || dto.endsAt) {
      const startsAt = dto.startsAt ? new Date(dto.startsAt) : event.startAt;
      const endsAt = dto.endsAt ? new Date(dto.endsAt) : event.endAt;
      const type = dto.type || event.type;
      const venue = dto.venue !== undefined ? dto.venue : event.venue;

      this.validateEventData({ startsAt, endsAt, type, venue });
    }

    // Update fields
    if (dto.title !== undefined && dto.title !== event.title) {
      event.title = dto.title;
      // Regenerate slug if title changed
      const baseSlug = this.slugify(dto.title);
      event.slug = await this.generateUniqueSlug(baseSlug, event.id);
    }

    if (dto.description !== undefined) {
      event.description = dto.description;
    }

    // bannerUrl is excluded from DTO to prevent direct writes
    // Use commitBanner endpoint instead
    // if (dto.bannerUrl !== undefined) {
    //   event.bannerUrl = dto.bannerUrl;
    // }

    if (dto.type !== undefined) {
      event.type = dto.type;
    }

    if (dto.venue !== undefined) {
      event.venue = dto.venue;
    }

    if (dto.startsAt !== undefined) {
      event.startAt = new Date(dto.startsAt);
    }

    if (dto.endsAt !== undefined) {
      event.endAt = new Date(dto.endsAt);
    }

    if (dto.isFeatured !== undefined || dto.featuredSortOrder !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenException(
          'Only admins can update featured homepage settings',
        );
      }
      if (dto.isFeatured !== undefined) {
        event.isFeatured = dto.isFeatured;
      }
      if (dto.featuredSortOrder !== undefined) {
        event.featuredSortOrder = dto.featuredSortOrder;
      }
    }

    const savedEvent = await this.eventRepository.save(event);

    if (isAdmin && event.organizer.userId !== userId) {
      // Only log when an admin is mutating someone else's event; we don't
      // want to spam the audit log if an admin who happens to also be the
      // organiser is editing their own event through the normal flow.
      await this.recordAdminAction(userId, 'ADMIN_UPDATE_EVENT', eventId, {
        organizerUserId: event.organizer.userId,
        // Persist the requested changes (not the merged entity) so a
        // reviewer can quickly see what the admin actually touched.
        changes: dto,
      });
    }

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Submit event for review (draft -> pending)
   */
  async submitForReview(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);
    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;

    if (
      event.status !== EventStatus.DRAFT &&
      event.status !== EventStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Event can only be submitted from draft or rejected status',
      );
    }

    // Validate required fields
    if (!event.title || !event.startAt || !event.endAt || !event.type) {
      throw new BadRequestException('Missing required fields');
    }

    if (
      (event.type === EventType.IN_PERSON || event.type === EventType.HYBRID) &&
      !event.venue
    ) {
      throw new BadRequestException(
        'venue is required for in_person and hybrid events',
      );
    }

    event.status = EventStatus.PENDING_REVIEW;
    // Stamp the first-submission time so the admin overview chart and
    // moderation queue can sort by "submitted" rather than "draft created"
    // (which was a misleading proxy). Re-submissions after a rejection
    // overwrite this on purpose — it's "most recent submission" not
    // "first ever".
    event.submittedAt = new Date();
    const savedEvent = await this.eventRepository.save(event);

    const eventForNotify = await this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer', 'organizer.user'],
    });
    if (eventForNotify) {
      await this.notifyEventSubmittedForReview(eventForNotify);
    }

    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminAction(userId, 'ADMIN_SUBMIT_EVENT', eventId, {
        organizerUserId: event.organizer.userId,
      });
    }

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Approve event (pending -> approved) - Admin only.
   *
   * Moderation now stops at APPROVED; the organiser is responsible for the
   * final PUBLISHED transition via `publish()` so they can stage the listing
   * and decide exactly when buyers can see it.
   */
  async approve(eventId: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== EventStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Event can only be approved from pending status',
      );
    }

    event.status = EventStatus.APPROVED;
    const savedEvent = await this.eventRepository.save(event);
    await this.notifyOrganizerReviewDecision(savedEvent.id, 'approved');

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Organiser self-serve publish (APPROVED -> PUBLISHED).
   *
   * Requires admin approval first and at least one ticket tier so we don't
   * accidentally publish a listing that has nothing to sell. Admins may
   * bypass the ownership check (same pattern as `update`/`remove`).
   */
  async publish(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);

    if (event.status !== EventStatus.APPROVED) {
      throw new BadRequestException(
        'Event can only be published from APPROVED status. Submit it for review first.',
      );
    }

    const ticketTierCount = await this.ticketTypeRepository.count({
      where: { eventId: event.id },
    });
    if (ticketTierCount === 0) {
      throw new BadRequestException(
        'Add at least one ticket tier before publishing the event.',
      );
    }

    event.status = EventStatus.PUBLISHED;
    const savedEvent = await this.eventRepository.save(event);
    await this.notifyOrganizerPublishAction(savedEvent.id, 'published');

    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;
    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminAction(userId, 'ADMIN_PUBLISH_EVENT', eventId, {
        organizerUserId: event.organizer.userId,
        previousStatus: EventStatus.APPROVED,
      });
    }

    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Organiser self-serve unpublish (PUBLISHED -> ARCHIVED).
   *
   * Allowed even when paid orders exist so an organiser can stop new sales
   * (e.g. cancellation, postponement) without going through support. Buyers
   * keep their tickets; the caller receives a `warning` in the response
   * metadata if paid orders exist so the UI can show a confirmation toast.
   */
  async unpublish(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<{ event: Event; warning?: string; paidOrderCount: number }> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        'Only PUBLISHED events can be unpublished.',
      );
    }

    const paidOrderCount = await this.orderRepository.count({
      where: { eventId, status: OrderStatus.PAID },
    });

    event.status = EventStatus.ARCHIVED;
    const savedEvent = await this.eventRepository.save(event);
    await this.notifyOrganizerPublishAction(savedEvent.id, 'unpublished');

    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;
    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminAction(userId, 'ADMIN_UNPUBLISH_EVENT', eventId, {
        organizerUserId: event.organizer.userId,
        previousStatus: EventStatus.PUBLISHED,
        paidOrderCount,
      });
    }

    const reloaded = (await this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    })) as Event;

    return {
      event: reloaded,
      paidOrderCount,
      warning:
        paidOrderCount > 0
          ? `This event has ${paidOrderCount} paid order(s). Existing tickets remain valid; contact support if you need refunds.`
          : undefined,
    };
  }

  /**
   * Duplicate an event into a new DRAFT owned by the same organiser.
   *
   * Copies the editorial fields plus every ticket tier (sold counts reset)
   * and every coupon (redemption counters reset). The new event always
   * starts in DRAFT regardless of the source status so the organiser can
   * adjust it before submitting for review.
   */
  async duplicate(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const source = await this.ensureOwnership(eventId, userId, userRoles);

    const sourceTiers = await this.ticketTypeRepository.find({
      where: { eventId: source.id },
      order: { createdAt: 'ASC' },
    });

    const sourceCoupons = await this.couponRepository.find({
      where: { eventId: source.id },
    });

    const newTitle = `${source.title} (Copy)`;
    const baseSlug = this.slugify(newTitle);
    const newSlug = await this.generateUniqueSlug(baseSlug);

    const duplicate = this.eventRepository.create({
      organizer: source.organizer,
      title: newTitle,
      description: source.description,
      type: source.type,
      venue: source.venue,
      city: source.city,
      country: source.country,
      startAt: source.startAt,
      endAt: source.endAt,
      category: source.category,
      isPublic: source.isPublic,
      // Featured flag is admin-only; never carry it over to the copy.
      isFeatured: false,
      featuredSortOrder: null,
      status: EventStatus.DRAFT,
      slug: newSlug,
      // Reset the moderation timestamp on the copy.
      submittedAt: null,
      // Banner intentionally not cloned — banners are stored under the
      // source event's key so the copy must upload its own.
      bannerUrl: null,
      metadata: source.metadata
        ? {
            ...source.metadata,
            duplicatedFromEventId: source.id,
            // Strip moderation metadata that doesn't apply to a fresh draft.
            rejectionReason: undefined,
            idemKey: undefined,
          }
        : { duplicatedFromEventId: source.id },
    });

    const savedDuplicate = await this.eventRepository.save(duplicate);

    if (sourceTiers.length > 0) {
      const newTiers = sourceTiers.map((tier) =>
        this.ticketTypeRepository.create({
          eventId: savedDuplicate.id,
          name: tier.name,
          description: tier.description,
          priceCents: tier.priceCents,
          currency: tier.currency,
          quantityTotal: tier.quantityTotal,
          quantitySold: 0,
          minPerOrder: tier.minPerOrder,
          maxPerOrder: tier.maxPerOrder,
          salesStart: tier.salesStart,
          salesEnd: tier.salesEnd,
          status: tier.status,
          allowInstallments: tier.allowInstallments,
          installmentConfig: tier.installmentConfig ?? null,
          // Hidden / comp-link tiers get a brand-new token on the copy so
          // the source listing's secret URL isn't accidentally exposed.
          isHidden: tier.isHidden,
          compLinkToken: tier.isHidden
            ? crypto.randomBytes(24).toString('base64url')
            : null,
        }),
      );
      await this.ticketTypeRepository.save(newTiers);
    }

    if (sourceCoupons.length > 0) {
      const newCoupons = sourceCoupons.map((coupon) =>
        this.couponRepository.create({
          // Append a short suffix so the duplicated coupon doesn't collide
          // with the source code (codes are globally unique). Organisers can
          // rename them after duplication.
          code: `${coupon.code}-copy-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          kind: coupon.kind,
          valueCents: coupon.valueCents,
          percentOff: coupon.percentOff,
          startAt: coupon.startAt,
          endAt: coupon.endAt,
          usageLimit: coupon.usageLimit,
          usedCount: 0,
          perUserLimit: coupon.perUserLimit,
          minOrderCents: coupon.minOrderCents,
          currency: coupon.currency,
          eventId: savedDuplicate.id,
          active: coupon.active,
        }),
      );
      await this.couponRepository.save(newCoupons);
    }

    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;
    if (isAdmin && source.organizer.userId !== userId) {
      await this.recordAdminAction(
        userId,
        'ADMIN_DUPLICATE_EVENT',
        savedDuplicate.id,
        {
          sourceEventId: source.id,
          organizerUserId: source.organizer.userId,
        },
      );
    }

    return this.eventRepository.findOne({
      where: { id: savedDuplicate.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Clear the banner image on an event. Organisers can wipe the banner
   * while the event is still in DRAFT, PENDING_REVIEW, REJECTED, or
   * APPROVED (i.e. anything before it goes live). Admins may clear it on
   * any status to remove inappropriate imagery.
   */
  async removeBanner(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);
    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;

    const organizerEditableStatuses: EventStatus[] = [
      EventStatus.DRAFT,
      EventStatus.PENDING_REVIEW,
      EventStatus.REJECTED,
      EventStatus.APPROVED,
    ];

    if (!isAdmin && !organizerEditableStatuses.includes(event.status)) {
      throw new BadRequestException(
        'Banner can only be removed while the event is DRAFT, PENDING_REVIEW, REJECTED, or APPROVED. Contact support for published events.',
      );
    }

    const previousBannerUrl = event.bannerUrl;
    event.bannerUrl = null;
    const savedEvent = await this.eventRepository.save(event);

    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminAction(
        userId,
        'ADMIN_REMOVE_EVENT_BANNER',
        eventId,
        {
          organizerUserId: event.organizer.userId,
          previousBannerUrl,
        },
      );
    }

    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Reject event (pending -> rejected) - Admin only
   */
  async reject(eventId: string, reason?: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== EventStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Event can only be rejected from pending status',
      );
    }

    event.status = EventStatus.REJECTED;
    event.metadata = {
      ...(event.metadata || {}),
      rejectionReason: reason,
    };

    const savedEvent = await this.eventRepository.save(event);
    await this.notifyOrganizerReviewDecision(savedEvent.id, 'rejected', reason);

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Commit banner URL to event
   * Validates URL matches expected pattern and updates event bannerUrl
   */
  async commitBanner(
    eventId: string,
    userId: string,
    url: string,
    userRoles?: Role[],
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);
    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;

    // Admins can swap banners on any event (e.g. to remove inappropriate
    // imagery that slipped past moderation).
    if (!isAdmin && !this.canEdit(event.status)) {
      throw new BadRequestException(
        'Banner can only be committed for events in DRAFT, PENDING_REVIEW, or REJECTED status',
      );
    }

    // URL validation is done in the controller
    // Here we just update the banner URL
    const previousBannerUrl = event.bannerUrl;
    event.bannerUrl = url;
    const savedEvent = await this.eventRepository.save(event);

    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminAction(
        userId,
        'ADMIN_UPDATE_EVENT_BANNER',
        eventId,
        {
          organizerUserId: event.organizer.userId,
          previousBannerUrl,
          newBannerUrl: url,
        },
      );
    }

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Find all events for an organizer
   */
  async findByOrganizer(userId: string): Promise<Event[]> {
    // Get organizer profile for user
    const organizerProfile = await this.organizerProfileRepository.findOne({
      where: { userId },
    });

    if (!organizerProfile) {
      throw new ForbiddenException(
        'Organizer profile not found. Please complete organizer onboarding first.',
      );
    }

    // Find all events for this organizer, ordered by most recent first
    return this.eventRepository.find({
      where: { organizer: { id: organizerProfile.id } },
      relations: ['organizer'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find published events for public listing with filters and pagination
   */
  async findPublicEvents(options: {
    page?: number;
    size?: number;
    q?: string;
    type?: EventType;
    dateFrom?: string;
    dateTo?: string;
    city?: string;
    featured?: boolean;
  }): Promise<{ events: Event[]; total: number; page: number; size: number }> {
    const page = options.page || 1;
    const size = Math.min(options.size || 20, 100); // Max 100 per page
    const skip = (page - 1) * size;

    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('event.ticketTypes', 'ticketTypes')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.isPublic = :isPublic', { isPublic: true });

    if (options.featured) {
      queryBuilder
        .andWhere('event.isFeatured = :isFeatured', { isFeatured: true })
        .orderBy('event.featuredSortOrder', 'ASC', 'NULLS LAST')
        .addOrderBy('event.startAt', 'ASC');
    } else {
      queryBuilder.orderBy('event.startAt', 'ASC');
    }

    // Hide ended events from open-ended catalogue queries.
    if (!options.dateFrom && !options.dateTo) {
      queryBuilder.andWhere('event.endAt >= :now', { now: new Date() });
    }

    // Search query
    if (options.q) {
      queryBuilder.andWhere(
        '(event.title ILIKE :q OR event.description ILIKE :q)',
        { q: `%${options.q}%` },
      );
    }

    // Type filter
    if (options.type) {
      queryBuilder.andWhere('event.type = :type', { type: options.type });
    }

    // Date filters
    if (options.dateFrom) {
      queryBuilder.andWhere('event.startAt >= :dateFrom', {
        dateFrom: new Date(options.dateFrom),
      });
    }

    if (options.dateTo) {
      queryBuilder.andWhere('event.startAt <= :dateTo', {
        dateTo: new Date(options.dateTo),
      });
    }

    // City filter
    if (options.city) {
      queryBuilder.andWhere('event.city ILIKE :city', {
        city: `%${options.city}%`,
      });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const events = await queryBuilder.skip(skip).take(size).getMany();

    for (const event of events) {
      event.ticketTypes = this.filterPublicTicketTypes(event.ticketTypes);
    }

    return {
      events,
      total,
      page,
      size,
    };
  }

  /** Omit hidden comp tiers from buyer-facing listings. */
  private filterPublicTicketTypes(ticketTypes?: TicketType[]): TicketType[] {
    return (ticketTypes ?? []).filter((tier) => !tier.isHidden);
  }

  /**
   * Find published event by slug for public access
   */
  async findBySlug(slug: string): Promise<Event> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('event.ticketTypes', 'ticketTypes')
      .where('event.slug = :slug', { slug })
      .andWhere('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.isPublic = :isPublic', { isPublic: true })
      .getOne();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    event.ticketTypes = this.filterPublicTicketTypes(event.ticketTypes);
    return event;
  }

  /**
   * Resolve a hidden comp/VIP tier by event slug + secret token.
   */
  async resolveCompLink(slug: string, token: string) {
    const event = await this.eventRepository.findOne({
      where: {
        slug,
        status: EventStatus.PUBLISHED,
        isPublic: true,
      },
      relations: ['organizer'],
    });
    if (!event) {
      throw new NotFoundException('Comp link not found');
    }

    const tier = await this.ticketTypeRepository.findOne({
      where: {
        eventId: event.id,
        compLinkToken: token,
        isHidden: true,
      },
    });
    if (!tier || tier.status !== TicketTypeStatus.ACTIVE) {
      throw new NotFoundException('Comp link not found');
    }

    const now = new Date();
    if (tier.salesStart && now < tier.salesStart) {
      throw new BadRequestException('This comp link is not active yet');
    }
    if (tier.salesEnd && now > tier.salesEnd) {
      throw new BadRequestException('This comp link has expired');
    }

    const remaining = tier.quantityTotal - tier.quantitySold;
    const quantity = tier.minPerOrder ?? 1;
    if (remaining < quantity) {
      throw new BadRequestException('This comp allocation is sold out');
    }

    return { event, tier, quantity };
  }

  /**
   * Recent admin override edits visible to the event organiser. Filters
   * `admin_audit_logs` to ADMIN_* mutation actions (excludes moderation
   * approve/reject) so the organiser editor can warn when platform staff
   * changed their listing.
   */
  async getAdminOverrideSummaryForOrganizer(
    eventId: string,
    userId: string,
    withinDays = 90,
  ): Promise<{
    hasRecentAdminEdits: boolean;
    withinDays: number;
    recentEditCount: number;
    lastEditedAt: string | null;
    entries: Array<{
      id: string;
      action: string;
      createdAt: string;
    }>;
  }> {
    await this.ensureOwnership(eventId, userId);

    const boundedDays = Math.min(Math.max(withinDays, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - boundedDays);

    const rows = await this.adminAuditLogRepository
      .createQueryBuilder('audit')
      .where('audit.resourceType = :type', { type: 'event' })
      .andWhere('audit.resourceId = :id', { id: eventId })
      .andWhere("audit.action LIKE 'ADMIN_%'")
      .andWhere('audit.status = :status', { status: 'SUCCESS' })
      .andWhere('audit.createdAt >= :since', { since })
      .orderBy('audit.createdAt', 'DESC')
      .limit(20)
      .getMany();

    return {
      hasRecentAdminEdits: rows.length > 0,
      withinDays: boundedDays,
      recentEditCount: rows.length,
      lastEditedAt: rows[0]?.createdAt?.toISOString() ?? null,
      entries: rows.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Permanently delete an event. Organisers may delete their own events only
   * while status is draft/pending/rejected and there are no paid orders.
   * Admins may delete any event (including seeded listings) for platform cleanup.
   */
  async remove(
    eventId: string,
    userId: string,
    userRoles?: Role[],
  ): Promise<void> {
    const event = await this.ensureOwnership(eventId, userId, userRoles);
    const isAdmin = userRoles?.includes(Role.ADMIN) ?? false;

    if (!isAdmin && !this.canEdit(event.status)) {
      throw new BadRequestException(
        'Events can only be deleted when status is draft, pending review, or rejected',
      );
    }

    if (!isAdmin) {
      const paidCount = await this.orderRepository.count({
        where: { eventId, status: OrderStatus.PAID },
      });
      if (paidCount > 0) {
        throw new BadRequestException(
          'Cannot delete an event that has paid orders. Contact support if you need this event removed.',
        );
      }
    }

    const auditSnapshot = {
      organizerUserId: event.organizer.userId,
      title: event.title,
      slug: event.slug,
      status: event.status,
    };

    try {
      await this.eventRepository.remove(event);

      if (isAdmin) {
        await this.recordAdminAction(
          userId,
          'ADMIN_DELETE_EVENT',
          eventId,
          auditSnapshot,
        );
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const message = error.message;
        if (
          message.includes('foreign key constraint') ||
          message.includes('violates foreign key')
        ) {
          throw new BadRequestException(
            'Cannot delete event: it is still referenced by orders, tickets, or payouts. Try again after related records are cleared, or contact support.',
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get event by ID for slug redirect (public access, returns slug)
   */
  async findSlugById(eventId: string): Promise<string> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['slug', 'status'],
    });

    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }

    return event.slug;
  }
}
