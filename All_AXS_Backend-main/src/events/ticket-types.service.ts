import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { TicketType } from './entities/ticket-type.entity';
import { Event } from './entities/event.entity';
import { EventStatus, TicketTypeStatus, Role } from 'src/domain/enums';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { EventsService } from './events.service';
import { InstallmentConfigValidator } from './installment-config.validator';

@Injectable()
export class TicketTypesService {
  private readonly logger = new Logger(TicketTypesService.name);

  constructor(
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly eventsService: EventsService,
    private readonly installmentValidator: InstallmentConfigValidator,
  ) {}

  /**
   * Check if event can be edited (only draft or pending status)
   */
  private canEditEvent(status: EventStatus): boolean {
    return (
      status === EventStatus.DRAFT || status === EventStatus.PENDING_REVIEW
    );
  }

  /**
   * Validate sales window
   * - Sales can start at any time (even before event)
   * - Sales end must be before or at event end (can't sell after event ends)
   * - Sales end must be after sales start
   */
  private validateSalesWindow(
    salesStart?: Date,
    salesEnd?: Date,
    eventStart?: Date,
    eventEnd?: Date,
  ): void {
    if (salesStart && salesEnd && salesEnd <= salesStart) {
      throw new BadRequestException('Sales end must be after sales start');
    }

    // Sales end must be before or at event end (can't sell tickets after event ends)
    if (eventEnd && salesEnd && salesEnd > eventEnd) {
      throw new BadRequestException('Sales end must be on or before event end');
    }

    // Optional: Sales end should ideally be before event starts (business rule)
    // But we'll allow it to go up to event end for flexibility
    // This is a soft recommendation, not a hard requirement
  }

  /**
   * Create a new ticket type for an event
   */
  async create(
    eventId: string,
    userId: string,
    userRoles: Role[],
    dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    // Check ownership and get event
    const event = await this.eventsService.ensureOwnership(eventId, userId);

    // Check if event is editable (unless admin)
    const isAdmin = userRoles?.includes(Role.ADMIN);
    if (!isAdmin && !this.canEditEvent(event.status)) {
      throw new BadRequestException(
        'Ticket types can only be created for events in DRAFT or PENDING_REVIEW status',
      );
    }

    // Validate sales window
    // Handle empty strings, null, and undefined by converting to undefined
    let salesStartAt: Date | undefined;
    let salesEndAt: Date | undefined;

    if (dto.salesStartAt) {
      const trimmed =
        typeof dto.salesStartAt === 'string'
          ? dto.salesStartAt.trim()
          : String(dto.salesStartAt);
      if (trimmed && trimmed !== '') {
        salesStartAt = new Date(trimmed);
        if (isNaN(salesStartAt.getTime())) {
          throw new BadRequestException('Invalid sales start date format');
        }
      }
    }

    if (dto.salesEndAt) {
      const trimmed =
        typeof dto.salesEndAt === 'string'
          ? dto.salesEndAt.trim()
          : String(dto.salesEndAt);
      if (trimmed && trimmed !== '') {
        salesEndAt = new Date(trimmed);
        if (isNaN(salesEndAt.getTime())) {
          throw new BadRequestException('Invalid sales end date format');
        }
      }
    }

    this.validateSalesWindow(
      salesStartAt,
      salesEndAt,
      event.startAt,
      event.endAt,
    );

    // Check for duplicate name (case-insensitive) within the same event
    const existing = await this.ticketTypeRepository
      .createQueryBuilder('ticketType')
      .where('ticketType.eventId = :eventId', { eventId })
      .andWhere('LOWER(ticketType.name) = LOWER(:name)', { name: dto.name })
      .getOne();

    if (existing) {
      throw new ConflictException(
        `A ticket type with the name "${dto.name}" already exists for this event`,
      );
    }

    // Ensure priceCents is provided and valid
    if (dto.priceCents === undefined || dto.priceCents === null) {
      throw new BadRequestException('Price (priceCents) is required');
    }

    // Ensure priceCents is an integer (handle any floating point issues)
    const priceCents = Math.round(Number(dto.priceCents));
    if (isNaN(priceCents) || priceCents < 0) {
      throw new BadRequestException(
        'Price must be a valid non-negative number',
      );
    }

    // Ensure quantity is an integer
    const quantity = Math.round(Number(dto.quantity));
    if (isNaN(quantity) || quantity < 0) {
      throw new BadRequestException(
        'Quantity must be a valid non-negative number',
      );
    }

    // Validate installment config if provided
    if (dto.allowInstallments && dto.installmentConfig) {
      await this.installmentValidator.validate(
        dto.installmentConfig,
        event.startAt,
      );
    } else if (dto.allowInstallments && !dto.installmentConfig) {
      throw new BadRequestException(
        'installmentConfig is required when allowInstallments is true',
      );
    }

    // Determine status: if quantity is 0, set to DISABLED
    const status =
      quantity === 0 ? TicketTypeStatus.DISABLED : TicketTypeStatus.ACTIVE;

    // Create ticket type
    try {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Creating ticket type for event ${eventId}: name=${dto.name}, priceCents=${priceCents}, quantity=${quantity}`,
        );
      }

      const ticketType = this.ticketTypeRepository.create({
        eventId: event.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
        priceCents,
        currency: 'KES', // Default currency
        quantityTotal: quantity,
        quantitySold: 0,
        minPerOrder: 1, // Default minimum
        maxPerOrder: dto.maxPerOrder
          ? Math.round(Number(dto.maxPerOrder))
          : undefined,
        salesStart: salesStartAt,
        salesEnd: salesEndAt,
        status,
        allowInstallments: dto.allowInstallments || false,
        installmentConfig: dto.installmentConfig || null,
      });

      const saved = await this.ticketTypeRepository.save(ticketType);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Created ticket type: ${saved.id} for event: ${eventId}`,
        );
      }

      return saved;
    } catch (error) {
      // Enhanced error logging for diagnostics
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorType =
          error instanceof Error ? error.constructor.name : typeof error;
        this.logger.error(`Error creating ticket type for event ${eventId}:`, {
          error: errorMessage,
          stack: errorStack,
          errorType,
          isQueryFailedError: error instanceof QueryFailedError,
        });
      }

      if (error instanceof QueryFailedError) {
        // Handle database constraint violations
        const message = error.message;
        const code = (error as QueryFailedError & { code?: string }).code; // PostgreSQL error code

        // Unique constraint violation (23505)
        if (
          code === '23505' ||
          message.includes('unique constraint') ||
          message.includes('duplicate key')
        ) {
          throw new ConflictException(
            `A ticket type with the name "${dto.name}" already exists for this event`,
          );
        }

        // Check constraint violation (23514)
        if (code === '23514' || message.includes('check constraint')) {
          if (
            message.includes('quantity_non_negative') ||
            message.includes('quantityTotal')
          ) {
            throw new BadRequestException('Quantity must be non-negative');
          }
          if (
            message.includes('max_per_order_positive') ||
            message.includes('maxPerOrder')
          ) {
            throw new BadRequestException('Max per order must be at least 1');
          }
          throw new BadRequestException(
            'Validation constraint violation: ' + message,
          );
        }

        // Foreign key violation (23503)
        if (code === '23503' || message.includes('foreign key constraint')) {
          if (message.includes('event_id') || message.includes('eventId')) {
            throw new NotFoundException('Event not found');
          }
          throw new BadRequestException('Invalid reference: ' + message);
        }

        // Invalid enum value (22P02) or column doesn't exist (42703)
        if (
          code === '22P02' ||
          code === '42703' ||
          message.includes('invalid input value for enum') ||
          (message.includes('column') && message.includes('does not exist'))
        ) {
          if (process.env.NODE_ENV !== 'production') {
            this.logger.error(
              `Database schema error: ${message}. This may indicate a migration issue.`,
              error.stack,
            );
          }
          throw new BadRequestException(
            'Database schema error. Please ensure all migrations have been run.',
          );
        }

        // Log unhandled QueryFailedError in dev mode
        if (process.env.NODE_ENV !== 'production') {
          this.logger.error(
            `Unhandled database error creating ticket type: code=${code}, message=${message}`,
            error.stack,
          );
        }
        // Map to 400 instead of 500 for user-correctable database errors
        throw new BadRequestException(
          `Database error: ${message.includes('constraint') ? 'Validation failed' : 'Failed to create ticket type'}`,
        );
      }

      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Log unexpected errors (these should be rare and indicate bugs)
      this.logger.error(
        `Unexpected error creating ticket type: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't expose internal errors to users, but map to 400 for user-correctable issues
      throw new BadRequestException(
        'Failed to create ticket type. Please check your input and try again.',
      );
    }
  }

  /**
   * Find all ticket types for an event
   */
  async findByEvent(
    eventId: string,
    userId?: string,
    userRoles?: Role[],
  ): Promise<TicketType[]> {
    // Get event to check access
    const event = await this.eventsService.findById(eventId, userId, userRoles);

    // Return ticket types for this event
    return this.ticketTypeRepository.find({
      where: { eventId: event.id },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find a ticket type by ID
   */
  async findOne(
    id: string,
    userId?: string,
    userRoles?: Role[],
  ): Promise<TicketType> {
    const ticketType = await this.ticketTypeRepository.findOne({
      where: { id },
      relations: ['event', 'event.organizer'],
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    // Check access to the event
    await this.eventsService.findById(ticketType.eventId, userId, userRoles);

    return ticketType;
  }

  /**
   * Update a ticket type
   */
  async update(
    id: string,
    userId: string,
    userRoles: Role[],
    dto: UpdateTicketTypeDto,
  ): Promise<TicketType> {
    const ticketType = await this.findOne(id, userId, userRoles);

    // Check ownership via event
    const event = await this.eventsService.ensureOwnership(
      ticketType.eventId,
      userId,
    );

    // Check if event is editable (unless admin)
    const isAdmin = userRoles?.includes(Role.ADMIN);
    if (!isAdmin && !this.canEditEvent(event.status)) {
      throw new BadRequestException(
        'Ticket types can only be updated for events in DRAFT or PENDING_REVIEW status',
      );
    }

    // Validate sales window if dates are provided
    // Handle empty strings, null, and undefined by converting to undefined
    let salesStartAt: Date | undefined;
    let salesEndAt: Date | undefined;

    if (dto.salesStartAt !== undefined) {
      if (dto.salesStartAt) {
        const trimmed =
          typeof dto.salesStartAt === 'string'
            ? dto.salesStartAt.trim()
            : String(dto.salesStartAt);
        if (trimmed && trimmed !== '') {
          salesStartAt = new Date(trimmed);
          if (isNaN(salesStartAt.getTime())) {
            throw new BadRequestException('Invalid sales start date format');
          }
        }
      }
    }

    if (dto.salesEndAt !== undefined) {
      if (dto.salesEndAt) {
        const trimmed =
          typeof dto.salesEndAt === 'string'
            ? dto.salesEndAt.trim()
            : String(dto.salesEndAt);
        if (trimmed && trimmed !== '') {
          salesEndAt = new Date(trimmed);
          if (isNaN(salesEndAt.getTime())) {
            throw new BadRequestException('Invalid sales end date format');
          }
        }
      }
    }

    if (salesStartAt !== undefined || salesEndAt !== undefined) {
      const salesStart =
        salesStartAt !== undefined ? salesStartAt : ticketType.salesStart;
      const salesEnd =
        salesEndAt !== undefined ? salesEndAt : ticketType.salesEnd;

      this.validateSalesWindow(
        salesStart,
        salesEnd,
        event.startAt,
        event.endAt,
      );
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== ticketType.name) {
      const existing = await this.ticketTypeRepository
        .createQueryBuilder('ticketType')
        .where('ticketType.eventId = :eventId', { eventId: event.id })
        .andWhere('ticketType.id != :id', { id: ticketType.id })
        .andWhere('LOWER(ticketType.name) = LOWER(:name)', { name: dto.name })
        .getOne();

      if (existing) {
        throw new ConflictException(
          `A ticket type with the name "${dto.name}" already exists for this event`,
        );
      }
    }

    // Validate installment config if being updated
    const isUpdatingInstallments =
      dto.allowInstallments !== undefined ||
      dto.installmentConfig !== undefined;
    if (isUpdatingInstallments) {
      const newAllowInstallments =
        dto.allowInstallments !== undefined
          ? dto.allowInstallments
          : ticketType.allowInstallments;
      const newConfig =
        dto.installmentConfig !== undefined
          ? dto.installmentConfig
          : ticketType.installmentConfig;

      if (newAllowInstallments && newConfig) {
        // Check if config is being modified and orders exist
        const configChanged =
          dto.installmentConfig !== undefined &&
          JSON.stringify(dto.installmentConfig) !==
            JSON.stringify(ticketType.installmentConfig);

        if (configChanged) {
          await this.installmentValidator.validateCanModify(ticketType.id);
        }

        await this.installmentValidator.validate(
          newConfig,
          event.startAt,
          configChanged ? ticketType.id : undefined,
        );
      } else if (newAllowInstallments && !newConfig) {
        throw new BadRequestException(
          'installmentConfig is required when allowInstallments is true',
        );
      }
    }

    // Update fields
    if (dto.name !== undefined) {
      ticketType.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      ticketType.description = dto.description?.trim() || undefined;
    }
    if (dto.priceCents !== undefined) {
      const priceCents = Math.round(Number(dto.priceCents));
      if (isNaN(priceCents) || priceCents < 0) {
        throw new BadRequestException(
          'Price must be a valid non-negative number',
        );
      }
      ticketType.priceCents = priceCents;
    }
    if (dto.quantity !== undefined) {
      const quantity = Math.round(Number(dto.quantity));
      if (isNaN(quantity) || quantity < 0) {
        throw new BadRequestException(
          'Quantity must be a valid non-negative number',
        );
      }
      ticketType.quantityTotal = quantity;
      // Update status if quantity becomes 0
      if (quantity === 0 && ticketType.status === TicketTypeStatus.ACTIVE) {
        ticketType.status = TicketTypeStatus.DISABLED;
      }
    }
    if (dto.maxPerOrder !== undefined) {
      if (dto.maxPerOrder === null || dto.maxPerOrder === undefined) {
        ticketType.maxPerOrder = undefined;
      } else {
        const maxPerOrder = Math.round(Number(dto.maxPerOrder));
        if (isNaN(maxPerOrder) || maxPerOrder < 1) {
          throw new BadRequestException('Max per order must be at least 1');
        }
        ticketType.maxPerOrder = maxPerOrder;
      }
    }
    if (dto.salesStartAt !== undefined) {
      ticketType.salesStart = salesStartAt;
    }
    if (dto.salesEndAt !== undefined) {
      ticketType.salesEnd = salesEndAt;
    }
    if (dto.allowInstallments !== undefined) {
      ticketType.allowInstallments = dto.allowInstallments;
    }
    if (dto.installmentConfig !== undefined) {
      ticketType.installmentConfig = dto.installmentConfig || null;
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Updating ticket type: ${id}`);
      }

      const saved = await this.ticketTypeRepository.save(ticketType);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Updated ticket type: ${saved.id}`);
      }

      return saved;
    } catch (error) {
      // Enhanced error logging for diagnostics
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorType =
          error instanceof Error ? error.constructor.name : typeof error;
        this.logger.error(`Error updating ticket type ${id}:`, {
          error: errorMessage,
          stack: errorStack,
          errorType,
          isQueryFailedError: error instanceof QueryFailedError,
        });
      }

      if (error instanceof QueryFailedError) {
        // Handle database constraint violations
        const message = error.message;
        const code = (error as QueryFailedError & { code?: string }).code; // PostgreSQL error code

        // Unique constraint violation (23505)
        if (
          code === '23505' ||
          message.includes('unique constraint') ||
          message.includes('duplicate key')
        ) {
          throw new ConflictException(
            `A ticket type with the name "${dto.name || ticketType.name}" already exists for this event`,
          );
        }

        // Check constraint violation (23514)
        if (code === '23514' || message.includes('check constraint')) {
          if (
            message.includes('quantity_non_negative') ||
            message.includes('quantityTotal')
          ) {
            throw new BadRequestException('Quantity must be non-negative');
          }
          if (
            message.includes('max_per_order_positive') ||
            message.includes('maxPerOrder')
          ) {
            throw new BadRequestException('Max per order must be at least 1');
          }
          throw new BadRequestException(
            'Validation constraint violation: ' + message,
          );
        }

        // Foreign key violation (23503)
        if (code === '23503' || message.includes('foreign key constraint')) {
          throw new BadRequestException('Invalid reference: ' + message);
        }

        // Invalid enum value (22P02) or column doesn't exist (42703)
        if (
          code === '22P02' ||
          code === '42703' ||
          message.includes('invalid input value for enum') ||
          (message.includes('column') && message.includes('does not exist'))
        ) {
          if (process.env.NODE_ENV !== 'production') {
            this.logger.error(
              `Database schema error: ${message}. This may indicate a migration issue.`,
              error.stack,
            );
          }
          throw new BadRequestException(
            'Database schema error. Please ensure all migrations have been run.',
          );
        }

        // Log unhandled QueryFailedError in dev mode
        if (process.env.NODE_ENV !== 'production') {
          this.logger.error(
            `Unhandled database error updating ticket type: code=${code}, message=${message}`,
            error.stack,
          );
        }
        // Map to 400 instead of 500 for user-correctable database errors
        throw new BadRequestException(
          `Database error: ${message.includes('constraint') ? 'Validation failed' : 'Failed to update ticket type'}`,
        );
      }

      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Log unexpected errors (these should be rare and indicate bugs)
      this.logger.error(
        `Unexpected error updating ticket type: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't expose internal errors to users, but map to 400 for user-correctable issues
      throw new BadRequestException(
        'Failed to update ticket type. Please check your input and try again.',
      );
    }
  }

  /**
   * Delete a ticket type
   */
  async remove(id: string, userId: string, userRoles: Role[]): Promise<void> {
    const ticketType = await this.findOne(id, userId, userRoles);

    // Check ownership via event
    const event = await this.eventsService.ensureOwnership(
      ticketType.eventId,
      userId,
    );

    // Check if event is editable (unless admin)
    const isAdmin = userRoles?.includes(Role.ADMIN);
    if (!isAdmin && !this.canEditEvent(event.status)) {
      throw new BadRequestException(
        'Ticket types can only be deleted for events in DRAFT or PENDING_REVIEW status',
      );
    }

    // Hard delete (no soft delete in this codebase)
    try {
      await this.ticketTypeRepository.remove(ticketType);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Deleted ticket type: ${id}`);
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        // Handle foreign key constraint violations
        const message = error.message;

        if (
          message.includes('foreign key constraint') ||
          message.includes('violates foreign key')
        ) {
          throw new BadRequestException(
            'Cannot delete ticket type: it is referenced by existing orders or tickets',
          );
        }

        // Log the actual error in dev mode
        if (process.env.NODE_ENV !== 'production') {
          this.logger.error(
            `Database error deleting ticket type: ${message}`,
            error.stack,
          );
        }
      }

      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Log unexpected errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Unexpected error deleting ticket type: ${errorMessage}`,
        errorStack,
      );
      throw new BadRequestException('Failed to delete ticket type');
    }
  }
}
