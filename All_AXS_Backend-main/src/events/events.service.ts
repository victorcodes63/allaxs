import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventStatus, EventType, Role } from 'src/domain/enums';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AdminAuditLog } from 'src/admin/entities/admin-audit-log.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
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

  private async notifyAdminsEventSubmitted(event: Event): Promise<void> {
    const admins = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: Role.ADMIN })
      .getMany();

    await Promise.allSettled(
      admins.map((admin) =>
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
      ),
    );
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
      title: approved ? 'Event approved' : 'Event needs changes',
      body: approved
        ? `${event.title} is now live on All AXS.`
        : reason
          ? `${event.title} was rejected: ${reason}`
          : `${event.title} was rejected. Open the editor to update and resubmit.`,
      link: approved
        ? `/events/${event.slug}`
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
    await this.notifyAdminsEventSubmitted(savedEvent);

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
   * Approve event (pending -> published) - Admin only
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

    event.status = EventStatus.PUBLISHED;
    const savedEvent = await this.eventRepository.save(event);
    await this.notifyOrganizerReviewDecision(savedEvent.id, 'approved');

    // Reload with organizer relation to ensure it's available for serialization
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
  }): Promise<{ events: Event[]; total: number; page: number; size: number }> {
    const page = options.page || 1;
    const size = Math.min(options.size || 20, 100); // Max 100 per page
    const skip = (page - 1) * size;

    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('event.ticketTypes', 'ticketTypes')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.isPublic = :isPublic', { isPublic: true })
      .orderBy('event.startAt', 'ASC');

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

    return {
      events,
      total,
      page,
      size,
    };
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

    return event;
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
