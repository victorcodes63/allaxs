import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponType, Role } from 'src/domain/enums';
import { EventsService } from './events.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AdminAuditLog } from 'src/admin/entities/admin-audit-log.entity';
import { CouponRedemption } from 'src/domain/coupon-redemption.entity';

export type CouponListItem = {
  id: string;
  eventId: string;
  code: string;
  kind: CouponType;
  valueCents?: number;
  percentOff?: number;
  startAt?: Date;
  endAt?: Date;
  usageLimit?: number;
  usedCount: number;
  perUserLimit?: number;
  minOrderCents?: number;
  currency?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Per-event coupon CRUD. The redemption path (validate + lock + increment
 * `usedCount` + insert `CouponRedemption`) lives in
 * `CheckoutService.initializePaystackCheckout` /
 * `completeDemoCheckout` and is not implemented here — see COUPONS_SPEC §5.
 */
@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly eventsService: EventsService,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
    @InjectRepository(CouponRedemption)
    private readonly couponRedemptionRepository: Repository<CouponRedemption>,
  ) {}

  private normaliseCode(input: string): string {
    return input.trim().toUpperCase();
  }

  private normaliseCurrency(input: string | undefined): string | undefined {
    return input ? input.trim().toUpperCase() : undefined;
  }

  private toListItem(c: Coupon): CouponListItem {
    return {
      id: c.id,
      eventId: c.eventId,
      code: c.code,
      kind: c.kind,
      valueCents: c.valueCents,
      percentOff: c.percentOff,
      startAt: c.startAt,
      endAt: c.endAt,
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      perUserLimit: c.perUserLimit,
      minOrderCents: c.minOrderCents,
      currency: c.currency,
      active: c.active,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private async recordAdminCouponAction(
    actorId: string,
    action: string,
    couponId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.adminAuditLogRepository.save(
        this.adminAuditLogRepository.create({
          adminUserId: actorId,
          action,
          resourceType: 'coupon',
          resourceId: couponId,
          metadata,
          status: 'SUCCESS',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to record admin audit entry for ${action} on coupon ${couponId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Ensure the parameters of `dto` make sense for the given coupon kind.
   * `FIXED` requires `valueCents > 0` and no `percentOff`; `PERCENT`
   * requires `1..100` and no `valueCents`.
   */
  private assertKindParameters(
    kind: CouponType,
    valueCents: number | undefined,
    percentOff: number | undefined,
  ): void {
    if (kind === CouponType.FIXED) {
      if (valueCents === undefined || valueCents === null) {
        throw new BadRequestException(
          'valueCents is required for FIXED coupons',
        );
      }
      if (percentOff !== undefined && percentOff !== null) {
        throw new BadRequestException(
          'percentOff must be omitted for FIXED coupons',
        );
      }
    } else if (kind === CouponType.PERCENT) {
      if (percentOff === undefined || percentOff === null) {
        throw new BadRequestException(
          'percentOff is required for PERCENT coupons',
        );
      }
      if (valueCents !== undefined && valueCents !== null) {
        throw new BadRequestException(
          'valueCents must be omitted for PERCENT coupons',
        );
      }
    }
  }

  /**
   * Ensure `startAt < endAt` when both are provided.
   */
  private assertWindow(startAt?: Date, endAt?: Date): void {
    if (startAt && endAt && endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }
  }

  async listForEvent(
    eventId: string,
    userId: string,
    userRoles: Role[],
  ): Promise<CouponListItem[]> {
    await this.eventsService.ensureOwnership(eventId, userId, userRoles);

    const rows = await this.couponRepository.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((c) => this.toListItem(c));
  }

  async findOne(
    id: string,
    userId: string,
    userRoles: Role[],
  ): Promise<CouponListItem> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    await this.eventsService.ensureOwnership(coupon.eventId, userId, userRoles);
    return this.toListItem(coupon);
  }

  async create(
    eventId: string,
    userId: string,
    userRoles: Role[],
    dto: CreateCouponDto,
  ): Promise<CouponListItem> {
    const event = await this.eventsService.ensureOwnership(
      eventId,
      userId,
      userRoles,
    );

    this.assertKindParameters(dto.kind, dto.valueCents, dto.percentOff);

    const startAt = dto.startAt ? new Date(dto.startAt) : undefined;
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (startAt && Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }
    if (endAt && Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid endAt');
    }
    this.assertWindow(startAt, endAt);

    const code = this.normaliseCode(dto.code);
    const currency = this.normaliseCurrency(dto.currency);

    try {
      const coupon = this.couponRepository.create({
        eventId: event.id,
        code,
        kind: dto.kind,
        valueCents:
          dto.kind === CouponType.FIXED ? dto.valueCents : undefined,
        percentOff:
          dto.kind === CouponType.PERCENT ? dto.percentOff : undefined,
        startAt,
        endAt,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        minOrderCents: dto.minOrderCents,
        currency,
        active: dto.active ?? true,
        usedCount: 0,
      });

      const saved = await this.couponRepository.save(coupon);

      const isAdmin = userRoles?.includes(Role.ADMIN);
      if (isAdmin && event.organizer.userId !== userId) {
        await this.recordAdminCouponAction(
          userId,
          'ADMIN_CREATE_COUPON',
          saved.id,
          {
            eventId: event.id,
            organizerUserId: event.organizer.userId,
            code: saved.code,
            kind: saved.kind,
          },
        );
      }

      return this.toListItem(saved);
    } catch (error) {
      this.mapQueryError(error, code);
      throw error;
    }
  }

  async update(
    id: string,
    userId: string,
    userRoles: Role[],
    dto: UpdateCouponDto,
  ): Promise<CouponListItem> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    const event = await this.eventsService.ensureOwnership(
      coupon.eventId,
      userId,
      userRoles,
    );

    const hasRedemptions = coupon.usedCount > 0;

    if (hasRedemptions) {
      if (
        dto.code !== undefined &&
        this.normaliseCode(dto.code) !== coupon.code
      ) {
        throw new ConflictException(
          'Code cannot be changed after the coupon has been redeemed',
        );
      }
      if (dto.kind !== undefined && dto.kind !== coupon.kind) {
        throw new ConflictException(
          'Discount kind cannot be changed after the coupon has been redeemed',
        );
      }
      if (
        dto.valueCents !== undefined &&
        dto.valueCents !== coupon.valueCents
      ) {
        throw new ConflictException(
          'Discount value cannot be changed after the coupon has been redeemed',
        );
      }
      if (
        dto.percentOff !== undefined &&
        dto.percentOff !== coupon.percentOff
      ) {
        throw new ConflictException(
          'Discount percent cannot be changed after the coupon has been redeemed',
        );
      }
    }

    // Apply changes onto the entity instance so the post-update entity
    // has the merged values for validation.
    if (dto.code !== undefined) coupon.code = this.normaliseCode(dto.code);
    if (dto.kind !== undefined) coupon.kind = dto.kind;
    if (dto.valueCents !== undefined) {
      coupon.valueCents = dto.valueCents;
    }
    if (dto.percentOff !== undefined) {
      coupon.percentOff = dto.percentOff;
    }
    if (dto.startAt !== undefined) {
      coupon.startAt = dto.startAt ? new Date(dto.startAt) : undefined;
      if (coupon.startAt && Number.isNaN(coupon.startAt.getTime())) {
        throw new BadRequestException('Invalid startAt');
      }
    }
    if (dto.endAt !== undefined) {
      coupon.endAt = dto.endAt ? new Date(dto.endAt) : undefined;
      if (coupon.endAt && Number.isNaN(coupon.endAt.getTime())) {
        throw new BadRequestException('Invalid endAt');
      }
    }
    if (dto.usageLimit !== undefined) {
      coupon.usageLimit = dto.usageLimit;
      if (
        coupon.usageLimit !== undefined &&
        coupon.usageLimit !== null &&
        coupon.usageLimit < coupon.usedCount
      ) {
        throw new BadRequestException(
          `usageLimit (${coupon.usageLimit}) cannot be below current usedCount (${coupon.usedCount})`,
        );
      }
    }
    if (dto.perUserLimit !== undefined) coupon.perUserLimit = dto.perUserLimit;
    if (dto.minOrderCents !== undefined) {
      coupon.minOrderCents = dto.minOrderCents;
    }
    if (dto.currency !== undefined) {
      coupon.currency = this.normaliseCurrency(dto.currency);
    }
    if (dto.active !== undefined) coupon.active = dto.active;

    // Re-run kind/value coherence checks against the merged state.
    this.assertKindParameters(
      coupon.kind,
      coupon.valueCents,
      coupon.percentOff,
    );
    this.assertWindow(coupon.startAt, coupon.endAt);

    try {
      const saved = await this.couponRepository.save(coupon);

      const isAdmin = userRoles?.includes(Role.ADMIN);
      if (isAdmin && event.organizer.userId !== userId) {
        await this.recordAdminCouponAction(
          userId,
          'ADMIN_UPDATE_COUPON',
          saved.id,
          {
            eventId: event.id,
            organizerUserId: event.organizer.userId,
            changes: dto,
          },
        );
      }

      return this.toListItem(saved);
    } catch (error) {
      this.mapQueryError(error, coupon.code);
      throw error;
    }
  }

  /**
   * "Delete" semantics:
   *
   *   - If the coupon has never been redeemed (`usedCount === 0`), the row
   *     is hard-deleted.
   *   - Otherwise the coupon is soft-disabled (`active = false`) so the
   *     redemption history and ledger references remain intact.
   *
   * Callers that explicitly want a soft-disable can also `PATCH { active:
   * false }` — both paths converge on the same outcome.
   */
  async remove(
    id: string,
    userId: string,
    userRoles: Role[],
  ): Promise<{ deleted: boolean; disabled: boolean; couponId: string }> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    const event = await this.eventsService.ensureOwnership(
      coupon.eventId,
      userId,
      userRoles,
    );

    const isAdmin = userRoles?.includes(Role.ADMIN);
    const auditSnapshot = {
      eventId: event.id,
      organizerUserId: event.organizer.userId,
      code: coupon.code,
      kind: coupon.kind,
      usedCount: coupon.usedCount,
    };

    if (coupon.usedCount === 0) {
      await this.couponRepository.remove(coupon);
      if (isAdmin && event.organizer.userId !== userId) {
        await this.recordAdminCouponAction(
          userId,
          'ADMIN_DELETE_COUPON',
          id,
          auditSnapshot,
        );
      }
      return { deleted: true, disabled: false, couponId: id };
    }

    coupon.active = false;
    await this.couponRepository.save(coupon);
    if (isAdmin && event.organizer.userId !== userId) {
      await this.recordAdminCouponAction(
        userId,
        'ADMIN_DISABLE_COUPON',
        id,
        auditSnapshot,
      );
    }
    return { deleted: false, disabled: true, couponId: id };
  }

  /**
   * Maps PostgreSQL constraint violations to friendly HTTP exceptions.
   * Mirrors `TicketTypesService` so the user-facing copy stays consistent.
   */
  private mapQueryError(error: unknown, code: string): void {
    if (!(error instanceof QueryFailedError)) return;
    const message = error.message;
    const pgCode = (error as QueryFailedError & { code?: string }).code;

    if (
      pgCode === '23505' ||
      message.includes('unique constraint') ||
      message.includes('duplicate key')
    ) {
      throw new ConflictException(
        `Coupon code "${code}" already exists. Try a different code.`,
      );
    }

    if (pgCode === '23514' || message.includes('check constraint')) {
      if (message.includes('percent_off_range')) {
        throw new BadRequestException('percentOff must be between 1 and 100');
      }
      if (message.includes('value_cents_positive')) {
        throw new BadRequestException('valueCents must be positive');
      }
      if (message.includes('min_order_cents_positive')) {
        throw new BadRequestException('minOrderCents must be non-negative');
      }
      throw new BadRequestException(
        'Validation constraint violation: ' + message,
      );
    }

    if (pgCode === '23503' || message.includes('foreign key constraint')) {
      throw new NotFoundException('Event not found');
    }

    if (
      pgCode === '22P02' ||
      pgCode === '42703' ||
      message.includes('invalid input value for enum') ||
      (message.includes('column') && message.includes('does not exist'))
    ) {
      this.logger.error(
        `Database schema error in coupons: ${message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Database schema error. Please ensure all migrations have been run.',
      );
    }

    // Re-throw known framework exceptions
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Redemption / preview (COUPONS_SPEC §3 + §5)
  // ---------------------------------------------------------------------------

  /**
   * Compute the discount a coupon would produce against a given subtotal,
   * capped at the subtotal so a $50 fixed-off coupon on a $30 order
   * doesn't overshoot.
   */
  private computeDiscountCents(coupon: Coupon, subtotalCents: number): number {
    if (coupon.kind === CouponType.PERCENT) {
      const pct = coupon.percentOff ?? 0;
      return Math.min(subtotalCents, Math.floor((subtotalCents * pct) / 100));
    }
    return Math.min(subtotalCents, coupon.valueCents ?? 0);
  }

  /**
   * Read-only validation. Used by the checkout preview endpoint and by
   * `redeem()` (inside its transaction) to share rule evaluation. Per
   * COUPONS_SPEC §3 — does NOT mutate any state.
   *
   * The per-user cap check uses both the JWT userId (when present) and
   * the buyer email, taking the max so authenticated buyers can't reset
   * their cap by signing out.
   */
  async validateForOrder(input: {
    code: string;
    eventId: string;
    userId: string | null;
    email: string | null;
    subtotalCents: number;
    currency: string;
  }): Promise<
    | { valid: true; coupon: Coupon; discountCents: number }
    | { valid: false; errorCode: string; message: string }
  > {
    const code = this.normaliseCode(input.code);
    const coupon = await this.couponRepository.findOne({ where: { code } });
    return this.evaluateAgainstCoupon(coupon, input);
  }

  /**
   * Shared rule evaluator. Operates on a loaded `Coupon` row (which may
   * have come from a plain read or a `pessimistic_write` lock inside a
   * transaction) so `validateForOrder` and `redeem` produce identical
   * decisions.
   */
  private async evaluateAgainstCoupon(
    coupon: Coupon | null,
    input: {
      code: string;
      eventId: string;
      userId: string | null;
      email: string | null;
      subtotalCents: number;
      currency: string;
    },
    manager?: EntityManager,
  ): Promise<
    | { valid: true; coupon: Coupon; discountCents: number }
    | { valid: false; errorCode: string; message: string }
  > {
    if (!coupon) {
      return {
        valid: false,
        errorCode: 'NOT_FOUND',
        message: 'Coupon code not recognized.',
      };
    }
    if (!coupon.active) {
      return {
        valid: false,
        errorCode: 'INACTIVE',
        message: 'This coupon is no longer active.',
      };
    }
    if (coupon.eventId !== input.eventId) {
      return {
        valid: false,
        errorCode: 'WRONG_EVENT',
        message: 'This coupon is not valid for this event.',
      };
    }

    const now = new Date();
    if (coupon.startAt && coupon.startAt.getTime() > now.getTime()) {
      return {
        valid: false,
        errorCode: 'NOT_STARTED',
        message: 'This coupon is not active yet.',
      };
    }
    if (coupon.endAt && coupon.endAt.getTime() <= now.getTime()) {
      return {
        valid: false,
        errorCode: 'EXPIRED',
        message: 'This coupon has expired.',
      };
    }

    if (
      coupon.currency &&
      input.currency &&
      coupon.currency.toUpperCase() !== input.currency.toUpperCase()
    ) {
      return {
        valid: false,
        errorCode: 'CURRENCY_MISMATCH',
        message: 'This coupon does not apply to this order currency.',
      };
    }

    if (
      typeof coupon.usageLimit === 'number' &&
      coupon.usedCount >= coupon.usageLimit
    ) {
      return {
        valid: false,
        errorCode: 'EXHAUSTED',
        message: 'This coupon has reached its total usage limit.',
      };
    }

    if (
      typeof coupon.minOrderCents === 'number' &&
      coupon.minOrderCents > 0 &&
      input.subtotalCents < coupon.minOrderCents
    ) {
      const minMajor = (coupon.minOrderCents / 100).toFixed(0);
      return {
        valid: false,
        errorCode: 'MIN_ORDER',
        message: `Minimum order of ${minMajor} ${coupon.currency || input.currency} required to use this code.`,
      };
    }

    if (typeof coupon.perUserLimit === 'number') {
      const repo = manager
        ? manager.getRepository(CouponRedemption)
        : this.couponRedemptionRepository;
      let userCount = 0;
      if (input.userId) {
        userCount = await repo.count({
          where: { couponId: coupon.id, userId: input.userId },
        });
      }
      let emailCount = 0;
      if (input.email) {
        emailCount = await repo.count({
          where: { couponId: coupon.id, email: input.email },
        });
      }
      if (Math.max(userCount, emailCount) >= coupon.perUserLimit) {
        return {
          valid: false,
          errorCode: 'PER_USER_EXHAUSTED',
          message: 'You have already used this coupon the maximum number of times.',
        };
      }
    }

    const discountCents = this.computeDiscountCents(
      coupon,
      input.subtotalCents,
    );
    if (discountCents <= 0) {
      return {
        valid: false,
        errorCode: 'ZERO_DISCOUNT',
        message: 'This coupon does not produce a discount on this order.',
      };
    }

    return { valid: true, coupon, discountCents };
  }

  /**
   * Authoritative redeem path called from inside the checkout transaction.
   * Locks the coupon row (`FOR UPDATE`), re-runs validation, atomically
   * increments `usedCount`, and inserts a `CouponRedemption` row.
   *
   * Throws `BadRequestException` on any validation failure so the caller
   * can abort the transaction; the message is buyer-friendly.
   */
  async redeem(
    manager: EntityManager,
    input: {
      code: string;
      eventId: string;
      orderId: string;
      userId: string | null;
      email: string;
      subtotalCents: number;
      currency: string;
    },
  ): Promise<{ couponId: string; discountCents: number }> {
    const code = this.normaliseCode(input.code);
    const coupon = await manager.findOne(Coupon, {
      where: { code },
      lock: { mode: 'pessimistic_write' },
    });

    const result = await this.evaluateAgainstCoupon(coupon, input, manager);
    if (!result.valid) {
      throw new BadRequestException(result.message);
    }

    const locked = result.coupon;
    locked.usedCount += 1;
    if (
      typeof locked.usageLimit === 'number' &&
      locked.usedCount > locked.usageLimit
    ) {
      // Someone else just hit the cap between read and write — bail out.
      throw new ConflictException(
        'This coupon has reached its total usage limit.',
      );
    }
    await manager.save(locked);

    const redemption = manager.create(CouponRedemption, {
      couponId: locked.id,
      orderId: input.orderId,
      userId: input.userId,
      email: input.email,
      discountCents: result.discountCents,
      currency: input.currency.toUpperCase(),
    });
    await manager.save(redemption);

    return { couponId: locked.id, discountCents: result.discountCents };
  }

  /**
   * Compensating action: when an order is refunded or cancelled, give
   * back the redemption so the cap reflects real outcomes. Best-effort
   * — failures are logged, not thrown, so refund flows can't get
   * blocked by ledger hiccups. See COUPONS_SPEC §7.
   */
  async rollbackRedemption(
    manager: EntityManager,
    orderId: string,
  ): Promise<void> {
    const redemption = await manager.findOne(CouponRedemption, {
      where: { orderId },
    });
    if (!redemption) return;

    const locked = await manager.findOne(Coupon, {
      where: { id: redemption.couponId },
      lock: { mode: 'pessimistic_write' },
    });
    if (locked && locked.usedCount > 0) {
      locked.usedCount -= 1;
      await manager.save(locked);
    }
    await manager.remove(redemption);
  }
}
