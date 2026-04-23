import {
  Injectable,
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

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
  ) {}

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
  async ensureOwnership(eventId: string, userId: string): Promise<Event> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.organizer', 'organizer')
      .where('event.id = :eventId', { eventId })
      .getOne();

    if (!event || !event.organizer) {
      throw new NotFoundException('Event not found');
    }

    if (event.organizer.userId !== userId) {
      throw new ForbiddenException('You do not own this event');
    }

    return event;
  }

  /**
   * Check if event can be edited (only draft or pending status)
   */
  private canEdit(status: EventStatus): boolean {
    return (
      status === EventStatus.DRAFT || status === EventStatus.PENDING_REVIEW
    );
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
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId);

    if (!this.canEdit(event.status)) {
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

    // Reload with organizer relation to ensure it's available for serialization
    return this.eventRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['organizer'],
    }) as Promise<Event>;
  }

  /**
   * Submit event for review (draft -> pending)
   */
  async submitForReview(eventId: string, userId: string): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId);

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException(
        'Event can only be submitted from draft status',
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
    const savedEvent = await this.eventRepository.save(event);

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
  ): Promise<Event> {
    const event = await this.ensureOwnership(eventId, userId);

    if (!this.canEdit(event.status)) {
      throw new BadRequestException(
        'Banner can only be committed for events in DRAFT or PENDING_REVIEW status',
      );
    }

    // URL validation is done in the controller
    // Here we just update the banner URL
    event.bannerUrl = url;
    const savedEvent = await this.eventRepository.save(event);

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
