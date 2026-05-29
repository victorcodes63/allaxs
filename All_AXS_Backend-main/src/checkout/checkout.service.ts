import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { Ticket } from '../domain/ticket.entity';
import { Payment } from '../domain/payment.entity';
import {
  EventStatus,
  NotifyStatus,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  TicketTypeStatus,
} from '../domain/enums';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';
import { PaystackInitDto } from './dto/paystack-init.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';
import { CompCheckoutInitDto } from './dto/comp-checkout-init.dto';
import { EmailService } from '../auth/services/email.service';
import {
  eventToEmailContext,
  ticketsFromEntities,
} from '../tickets/ticket-email.util';
import { computePlatformFeeCents } from './platform-fee.util';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { CouponsService } from '../events/coupons.service';
import { EventsService } from '../events/events.service';
import { Coupon } from '../events/entities/coupon.entity';
import { AuthService } from '../auth/auth.service';
import { TokenMetadata } from '../auth/services/refresh-token.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  parseOrderNotes,
  shouldSendTicketWhatsApp,
} from '../notifications/order-notes.util';
import { PaymentPlansService } from '../domain/payment-plans.service';
import {
  PaymentInstallment,
  PaymentInstallmentStatus,
} from '../domain/payment-installment.entity';
import { PaymentPlanStatus } from '../domain/payment-plan.entity';
import {
  WaitlistService,
  type WaitlistPurchaseContext,
} from '../events/waitlist.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly organizerLedgerService: OrganizerLedgerService,
    private readonly couponsService: CouponsService,
    private readonly eventsService: EventsService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentPlansService: PaymentPlansService,
    private readonly waitlistService: WaitlistService,
  ) {}

  private assertInstallmentCheckoutAllowed(
    dto: PaystackInitDto,
    tierById: Map<string, TicketType>,
  ): TicketType {
    if (dto.lines.length !== 1) {
      throw new BadRequestException(
        'Installment checkout supports one ticket tier per order',
      );
    }
    const tier = tierById.get(dto.lines[0].ticketTypeId);
    if (!tier?.allowInstallments || !tier.installmentConfig) {
      throw new BadRequestException(
        'This ticket tier does not support installment payments',
      );
    }
    return tier;
  }

  private async resolveWaitlistContext(dto: {
    eventId: string;
    buyerEmail: string;
    waitlistToken?: string;
    lines: { ticketTypeId: string; quantity: number }[];
  }): Promise<WaitlistPurchaseContext | null> {
    if (!dto.waitlistToken?.trim()) {
      return null;
    }
    const ctx = await this.waitlistService.resolvePurchaseContext(
      dto.waitlistToken.trim(),
      dto.buyerEmail,
      dto.eventId,
    );
    if (
      dto.lines.length !== 1 ||
      dto.lines[0].ticketTypeId !== ctx.tierId
    ) {
      throw new BadRequestException(
        'Waitlist checkout must purchase only the tier from your offer',
      );
    }
    return ctx;
  }

  private assertTierOnSale(
    tier: TicketType,
    waitlistContext: WaitlistPurchaseContext | null,
  ): void {
    if (tier.status === TicketTypeStatus.ACTIVE) {
      return;
    }
    if (waitlistContext && tier.id === waitlistContext.tierId) {
      return;
    }
    throw new BadRequestException(`Ticket type ${tier.name} is not on sale`);
  }

  private assertDemoCheckoutEnabled(): void {
    const enabled = this.configService.get<string>('ENABLE_DEMO_CHECKOUT') === 'true';
    const nonProd = this.configService.get<string>('NODE_ENV') !== 'production';
    if (!enabled && !nonProd) {
      throw new ForbiddenException(
        'Demo checkout is disabled. Set ENABLE_DEMO_CHECKOUT=true to enable in production.',
      );
    }
  }

  async completeDemoCheckout(
    userId: string,
    dto: DemoCheckoutDto,
  ): Promise<{
    order: {
      id: string;
      eventId: string;
      totalCents: number;
      currency: string;
      eventTitle: string;
      eventSlug: string;
      buyerName: string;
      buyerEmail: string;
      lineItems: {
        ticketTypeId: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        currency: string;
      }[];
    };
    tickets: {
      id: string;
      ticketTypeId: string;
      tierName: string;
      qrNonce: string;
      qrSignature: string;
    }[];
    coupon?: {
      code: string;
      discountCents: number;
    };
  }> {
    this.assertDemoCheckoutEnabled();
    await this.authService.assertEmailVerifiedForCheckout(userId);
    const waitlistContext = await this.resolveWaitlistContext(dto);

    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id: dto.eventId, status: EventStatus.PUBLISHED },
        relations: ['ticketTypes', 'organizer'],
      });
      if (!event) {
        throw new NotFoundException('Published event not found');
      }

      const tierById = new Map(
        (event.ticketTypes ?? []).map((t) => [t.id, t]),
      );

      let totalCents = 0;
      const normalizedLines: {
        ticketTypeId: string;
        qty: number;
        unitPriceCents: number;
        currency: string;
        name: string;
      }[] = [];

      for (const line of dto.lines) {
        const tier = tierById.get(line.ticketTypeId);
        if (!tier || tier.eventId !== event.id) {
          throw new BadRequestException(
            `Ticket type ${line.ticketTypeId} does not belong to this event`,
          );
        }
        this.assertTierOnSale(tier, waitlistContext);
        const locked = await manager.findOne(TicketType, {
          where: { id: tier.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) {
          throw new BadRequestException('Ticket type not found');
        }
        const remaining = locked.quantityTotal - locked.quantitySold;
        if (line.quantity < locked.minPerOrder) {
          throw new BadRequestException(
            `${locked.name}: minimum ${locked.minPerOrder} per order`,
          );
        }
        if (locked.maxPerOrder && line.quantity > locked.maxPerOrder) {
          throw new BadRequestException(
            `${locked.name}: maximum ${locked.maxPerOrder} per order`,
          );
        }
        if (line.quantity > remaining) {
          throw new BadRequestException(`${locked.name}: only ${remaining} seats left`);
        }
        totalCents += locked.priceCents * line.quantity;
        normalizedLines.push({
          ticketTypeId: locked.id,
          qty: line.quantity,
          unitPriceCents: locked.priceCents,
          currency: locked.currency,
          name: locked.name,
        });
      }

      const reference = `demo_${crypto.randomUUID()}`;
      const orderCurrency = normalizedLines[0]?.currency ?? 'KES';

      const order = manager.create(Order, {
        userId,
        eventId: event.id,
        status: OrderStatus.PAID,
        amountCents: totalCents,
        feesCents: 0,
        discountCents: 0,
        appliedCouponId: null,
        currency: orderCurrency,
        reference,
        email: dto.buyerEmail,
        phone: dto.buyerPhone,
        notes: JSON.stringify({
          demo: true,
          buyerName: dto.buyerName,
          ...(dto.ticketDelivery ? { ticketDelivery: dto.ticketDelivery } : {}),
          ...(waitlistContext
            ? { waitlistEntryId: waitlistContext.entryId }
            : {}),
        }),
      });
      await manager.save(order);

      // Coupon redemption (COUPONS_SPEC §5.1). Demo flow exercises the
      // same lock + redeem path so dev environments can validate
      // coupons end-to-end without Paystack.
      let discountCents = 0;
      let appliedCouponId: string | null = null;
      if (dto.couponCode) {
        const redeemResult = await this.couponsService.redeem(manager, {
          code: dto.couponCode,
          eventId: event.id,
          orderId: order.id,
          userId,
          email: dto.buyerEmail,
          subtotalCents: totalCents,
          currency: orderCurrency,
        });
        discountCents = redeemResult.discountCents;
        appliedCouponId = redeemResult.couponId;
      }

      const chargeableCents = Math.max(0, totalCents - discountCents);
      const feesCents = computePlatformFeeCents(chargeableCents, (k) =>
        this.configService.get<string>(k),
      );
      order.amountCents = chargeableCents;
      order.feesCents = feesCents;
      order.discountCents = discountCents;
      order.appliedCouponId = appliedCouponId;
      await manager.save(order);

      for (const line of normalizedLines) {
        const item = manager.create(OrderItem, {
          orderId: order.id,
          ticketTypeId: line.ticketTypeId,
          qty: line.qty,
          unitPriceCents: line.unitPriceCents,
          currency: line.currency,
        });
        await manager.save(item);

        const tier = await manager.findOne(TicketType, {
          where: { id: line.ticketTypeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (tier) {
          tier.quantitySold += line.qty;
          await manager.save(tier);
        }
      }

      const payment = manager.create(Payment, {
        orderId: order.id,
        gateway: PaymentGateway.PAYSTACK,
        intentId: `demo_pay_${crypto.randomUUID()}`,
        status: PaymentStatus.SUCCESS,
        amountCents: chargeableCents,
        currency: order.currency,
        rawPayload: { demo: true, appliedCouponId, discountCents },
      });
      await manager.save(payment);

      const organizerId = event.organizer?.id ?? (event as Event & { organizerId?: string }).organizerId;
      if (organizerId) {
        await this.organizerLedgerService.ensureOrderEarnings(manager, order, organizerId);
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
      const issuedTickets: {
        id: string;
        ticketTypeId: string;
        tierName: string;
        qrNonce: string;
        qrSignature: string;
      }[] = [];

      for (const line of normalizedLines) {
        for (let i = 0; i < line.qty; i++) {
          const qrNonce = `qr_${crypto.randomUUID().replace(/-/g, '')}`;
          const ticket = manager.create(Ticket, {
            orderId: order.id,
            ticketTypeId: line.ticketTypeId,
            ownerUserId: userId,
            attendeeName: dto.buyerName,
            attendeeEmail: dto.buyerEmail,
            attendeePhone: dto.buyerPhone,
            qrNonce,
            qrSignature: '',
          });
          await manager.save(ticket);
          const sig = crypto
            .createHmac('sha256', secret)
            .update(`${ticket.id}:${qrNonce}`)
            .digest('hex');
          ticket.qrSignature = sig;
          await manager.save(ticket);
          issuedTickets.push({
            id: ticket.id,
            ticketTypeId: line.ticketTypeId,
            tierName: line.name,
            qrNonce,
            qrSignature: sig,
          });
        }
      }

      return {
        order: {
          id: order.id,
          eventId: event.id,
          totalCents: totalCents,
          currency: order.currency,
          eventTitle: event.title,
          eventSlug: event.slug,
          buyerName: dto.buyerName,
          buyerEmail: dto.buyerEmail,
          lineItems: normalizedLines.map((l) => ({
            ticketTypeId: l.ticketTypeId,
            name: l.name,
            quantity: l.qty,
            unitPriceCents: l.unitPriceCents,
            currency: l.currency,
          })),
        },
        tickets: issuedTickets,
        coupon:
          dto.couponCode && discountCents > 0
            ? { code: dto.couponCode.trim().toUpperCase(), discountCents }
            : undefined,
      };
    }).then(async (result) => {
      if (waitlistContext) {
        await this.waitlistService.markPurchased(waitlistContext.entryId);
      }
      return result;
    });
  }

  /**
   * Stateless preview of what a coupon would do to a buyer's cart.
   * Mirrors the validation rules used by `redeem` but does not lock the
   * coupon row, does not increment `usedCount`, and does not insert a
   * `CouponRedemption`. Per COUPONS_SPEC §3 + §5.
   */
  async previewCoupon(
    userId: string | null,
    dto: CouponPreviewDto,
  ): Promise<{
    valid: boolean;
    errorCode?: string;
    message?: string;
    code: string;
    subtotalCents: number;
    discountCents: number;
    amountCents: number;
    feesCents: number;
    currency: string;
  }> {
    const event = await this.dataSource.getRepository(Event).findOne({
      where: { id: dto.eventId, status: EventStatus.PUBLISHED },
      relations: ['ticketTypes'],
    });
    if (!event) {
      throw new NotFoundException('Published event not found');
    }

    const tierById = new Map(
      (event.ticketTypes ?? []).map((t) => [t.id, t]),
    );
    let subtotalCents = 0;
    let currency = 'KES';
    for (const line of dto.lines) {
      const tier = tierById.get(line.ticketTypeId);
      if (!tier || tier.eventId !== event.id) {
        throw new BadRequestException(
          `Ticket type ${line.ticketTypeId} does not belong to this event`,
        );
      }
      if (tier.status !== TicketTypeStatus.ACTIVE) {
        throw new BadRequestException(
          `Ticket type ${tier.name} is not on sale`,
        );
      }
      subtotalCents += tier.priceCents * line.quantity;
      currency = tier.currency || currency;
    }

    const normalisedCode = dto.couponCode.trim().toUpperCase();
    const result = await this.couponsService.validateForOrder({
      code: normalisedCode,
      eventId: event.id,
      userId,
      email: dto.buyerEmail ?? null,
      subtotalCents,
      currency,
    });

    if (!result.valid) {
      const feesCents = computePlatformFeeCents(subtotalCents, (k) =>
        this.configService.get<string>(k),
      );
      return {
        valid: false,
        errorCode: result.errorCode,
        message: result.message,
        code: normalisedCode,
        subtotalCents,
        discountCents: 0,
        amountCents: subtotalCents,
        feesCents,
        currency,
      };
    }

    const amountCents = Math.max(0, subtotalCents - result.discountCents);
    const feesCents = computePlatformFeeCents(amountCents, (k) =>
      this.configService.get<string>(k),
    );
    return {
      valid: true,
      code: normalisedCode,
      subtotalCents,
      discountCents: result.discountCents,
      amountCents,
      feesCents,
      currency,
    };
  }

  /**
   * Public guest checkout: resolve or auto-create the buyer, then start
   * Paystack. New accounts receive session tokens for the return URL.
   */
  async initializeGuestPaystackCheckout(
    dto: PaystackInitDto,
    metadata?: TokenMetadata,
  ) {
    const provisioned = await this.authService.provisionGuestCheckoutUser(
      {
        email: dto.buyerEmail,
        name: dto.buyerName,
        phone: dto.buyerPhone,
      },
      metadata,
    );

    if (!provisioned.accountCreated && !provisioned.user.autoCreatedAt) {
      throw new ConflictException({
        message:
          'An account with this email already exists. Sign in to complete checkout.',
        code: 'SIGN_IN_REQUIRED',
      });
    }

    const checkout = await this.initializePaystackCheckout(provisioned.user.id, {
      ...dto,
      guestCheckout: true,
    });

    return {
      ...checkout,
      accountCreated: provisioned.accountCreated,
      user: {
        id: provisioned.user.id,
        email: provisioned.user.email,
        name: provisioned.user.name ?? '',
      },
      tokens: provisioned.tokens,
    };
  }

  /**
   * Comp / VIP link checkout — fixed hidden tier, 100% comp discount,
   * skips Paystack via the same free-order finalize path as coupons.
   */
  async initializeCompCheckout(
    dto: CompCheckoutInitDto,
    metadata?: TokenMetadata,
  ) {
    const { event, tier, quantity } = await this.eventsService.resolveCompLink(
      dto.slug,
      dto.compToken,
    );

    const provisioned = await this.authService.provisionGuestCheckoutUser(
      {
        email: dto.buyerEmail,
        name: dto.buyerName,
        phone: dto.buyerPhone,
      },
      metadata,
    );

    const reference = `comp_${crypto.randomUUID().replace(/-/g, '')}`;

    const prepared = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(TicketType, {
        where: { id: tier.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== TicketTypeStatus.ACTIVE) {
        throw new BadRequestException('This comp link is no longer available');
      }
      const remaining = locked.quantityTotal - locked.quantitySold;
      if (quantity > remaining) {
        throw new BadRequestException('This comp allocation is sold out');
      }

      const subtotalCents = locked.priceCents * quantity;
      const discountCents = subtotalCents;
      const chargeableCents = 0;
      const feesCents = 0;

      const order = manager.create(Order, {
        userId: provisioned.user.id,
        eventId: event.id,
        status: OrderStatus.PENDING,
        amountCents: chargeableCents,
        feesCents,
        discountCents,
        appliedCouponId: null,
        currency: locked.currency,
        reference,
        email: dto.buyerEmail,
        phone: dto.buyerPhone,
        notes: JSON.stringify({
          buyerName: dto.buyerName,
          guestCheckout: true,
          compLink: true,
          compToken: dto.compToken,
          ticketTypeId: locked.id,
        }),
      });
      await manager.save(order);

      await manager.save(
        manager.create(OrderItem, {
          orderId: order.id,
          ticketTypeId: locked.id,
          qty: quantity,
          unitPriceCents: locked.priceCents,
          currency: locked.currency,
        }),
      );

      await manager.save(
        manager.create(Payment, {
          orderId: order.id,
          gateway: PaymentGateway.PAYSTACK,
          intentId: reference,
          status: PaymentStatus.INITIATED,
          amountCents: chargeableCents,
          currency: locked.currency,
          txRef: reference,
          rawPayload: {
            stage: 'comp_link_initialized',
            compToken: dto.compToken,
            discountCents,
          },
        }),
      );

      return { order, chargeableCents, discountCents };
    });

    await this.finalizeSuccessfulPayment(
      reference,
      { reference, status: 'success', source: 'free_order', compLink: true },
      'free_order',
    );

    return {
      orderId: prepared.order.id,
      reference,
      authorizationUrl: null,
      status: 'PAID' as const,
      discountCents: prepared.discountCents,
      amountCents: 0,
      accountCreated: provisioned.accountCreated,
      user: {
        id: provisioned.user.id,
        email: provisioned.user.email,
        name: provisioned.user.name ?? '',
      },
      tokens: provisioned.tokens,
    };
  }

  async initializePaystackCheckout(userId: string, dto: PaystackInitDto) {
    if (!dto.guestCheckout) {
      await this.authService.assertEmailVerifiedForCheckout(userId);
    }
    const waitlistContext = await this.resolveWaitlistContext(dto);

    const reference = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
    const callbackUrl = this.getPaystackCallbackUrl();
    const secret = this.getPaystackSecret();

    const prepared = await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id: dto.eventId, status: EventStatus.PUBLISHED },
        relations: ['ticketTypes'],
      });
      if (!event) {
        throw new NotFoundException('Published event not found');
      }

      const tierById = new Map((event.ticketTypes ?? []).map((t) => [t.id, t]));
      const installmentTier = dto.payInInstallments
        ? this.assertInstallmentCheckoutAllowed(dto, tierById)
        : null;
      let totalCents = 0;
      const normalizedLines: {
        ticketTypeId: string;
        qty: number;
        unitPriceCents: number;
        currency: string;
        name: string;
      }[] = [];

      for (const line of dto.lines) {
        const tier = tierById.get(line.ticketTypeId);
        if (!tier || tier.eventId !== event.id) {
          throw new BadRequestException(
            `Ticket type ${line.ticketTypeId} does not belong to this event`,
          );
        }
        this.assertTierOnSale(tier, waitlistContext);
        const locked = await manager.findOne(TicketType, {
          where: { id: tier.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) {
          throw new BadRequestException('Ticket type not found');
        }
        const remaining = locked.quantityTotal - locked.quantitySold;
        if (line.quantity < locked.minPerOrder) {
          throw new BadRequestException(
            `${locked.name}: minimum ${locked.minPerOrder} per order`,
          );
        }
        if (locked.maxPerOrder && line.quantity > locked.maxPerOrder) {
          throw new BadRequestException(
            `${locked.name}: maximum ${locked.maxPerOrder} per order`,
          );
        }
        if (line.quantity > remaining) {
          throw new BadRequestException(`${locked.name}: only ${remaining} seats left`);
        }

        totalCents += locked.priceCents * line.quantity;
        normalizedLines.push({
          ticketTypeId: locked.id,
          qty: line.quantity,
          unitPriceCents: locked.priceCents,
          currency: locked.currency,
          name: locked.name,
        });
      }

      const orderCurrency = normalizedLines[0]?.currency ?? 'KES';

      // Provisional order — values reconciled after redeem so the
      // `appliedCouponId` FK is set under the same write lock.
      const order = manager.create(Order, {
        userId,
        eventId: event.id,
        status: OrderStatus.PENDING,
        amountCents: totalCents,
        feesCents: 0,
        discountCents: 0,
        appliedCouponId: null,
        currency: orderCurrency,
        reference,
        email: dto.buyerEmail,
        phone: dto.buyerPhone,
        notes: JSON.stringify({
          buyerName: dto.buyerName,
          guestCheckout: dto.guestCheckout === true,
          ...(dto.ticketDelivery ? { ticketDelivery: dto.ticketDelivery } : {}),
          ...(dto.payInInstallments ? { payInInstallments: true } : {}),
        }),
      });
      await manager.save(order);

      // Coupon redemption (COUPONS_SPEC §5.1). Locks the coupon row,
      // re-runs the validation rules under the lock, increments
      // `usedCount`, and writes the audit row to `coupon_redemptions`.
      let discountCents = 0;
      let appliedCouponId: string | null = null;
      if (dto.couponCode) {
        const redeemResult = await this.couponsService.redeem(manager, {
          code: dto.couponCode,
          eventId: event.id,
          orderId: order.id,
          userId,
          email: dto.buyerEmail,
          subtotalCents: totalCents,
          currency: orderCurrency,
        });
        discountCents = redeemResult.discountCents;
        appliedCouponId = redeemResult.couponId;
      }

      const chargeableCents = Math.max(0, totalCents - discountCents);
      const feesCents = computePlatformFeeCents(chargeableCents, (k) =>
        this.configService.get<string>(k),
      );
      order.amountCents = chargeableCents;
      order.feesCents = feesCents;
      order.discountCents = discountCents;
      order.appliedCouponId = appliedCouponId;
      await manager.save(order);

      for (const line of normalizedLines) {
        await manager.save(
          manager.create(OrderItem, {
            orderId: order.id,
            ticketTypeId: line.ticketTypeId,
            qty: line.qty,
            unitPriceCents: line.unitPriceCents,
            currency: line.currency,
          }),
        );
      }

      await manager.save(
        manager.create(Payment, {
          orderId: order.id,
          gateway: PaymentGateway.PAYSTACK,
          intentId: reference,
          status: PaymentStatus.INITIATED,
          amountCents: chargeableCents,
          currency: order.currency,
          txRef: reference,
          rawPayload: {
            stage: 'initialized_locally',
            appliedCouponId,
            discountCents,
          },
        }),
      );

      return {
        order,
        event,
        normalizedLines,
        totalCents,
        chargeableCents,
        discountCents,
        appliedCouponId,
        installmentTier,
      };
    });

    let paystackAmountCents = prepared.chargeableCents;
    let installmentSequence = 0;

    if (dto.payInInstallments && prepared.installmentTier) {
      const plan = await this.paymentPlansService.createPaymentPlan(
        prepared.order.id,
        prepared.installmentTier.id,
        prepared.chargeableCents,
        prepared.order.currency,
        prepared.installmentTier.installmentConfig!,
        prepared.order.createdAt,
      );
      const firstInst = [...(plan.installments ?? [])].sort(
        (a, b) => a.sequence - b.sequence,
      )[0];
      if (!firstInst) {
        throw new BadRequestException('Installment plan is missing the first payment');
      }
      paystackAmountCents = firstInst.amount;
      installmentSequence = firstInst.sequence;

      const paymentRepo = this.dataSource.getRepository(Payment);
      const payment = await paymentRepo.findOne({
        where: { intentId: reference },
      });
      if (payment) {
        payment.amountCents = paystackAmountCents;
        payment.rawPayload = {
          ...(payment.rawPayload ?? {}),
          payInInstallments: true,
          installmentSequence,
          planTotalCents: prepared.chargeableCents,
        };
        await paymentRepo.save(payment);
      }
    }

    // 100%-off coupon path (COUPONS_SPEC §6). Skip Paystack entirely
    // and finalize the order in-band so tickets + emails get issued
    // the same way `processPaystackWebhook` would have.
    if (paystackAmountCents === 0) {
      await this.finalizeSuccessfulPayment(
        reference,
        { reference, status: 'success', source: 'free_order' },
        'free_order',
      );
      return {
        orderId: prepared.order.id,
        reference,
        authorizationUrl: null,
        status: 'PAID' as const,
        discountCents: prepared.discountCents,
        amountCents: 0,
      };
    }

    const initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: dto.buyerEmail,
        amount: paystackAmountCents,
        currency: prepared.order.currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          orderId: prepared.order.id,
          userId,
          eventId: prepared.order.eventId,
          buyerName: dto.buyerName,
          buyerPhone: dto.buyerPhone ?? '',
          appliedCouponId: prepared.appliedCouponId,
          discountCents: prepared.discountCents,
          ...(dto.payInInstallments
            ? {
                payInInstallments: true,
                installmentSequence,
                planTotalCents: prepared.chargeableCents,
              }
            : {}),
        },
      }),
    });

    const initData = (await initResponse.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    };

    if (!initResponse.ok || !initData.status || !initData.data?.authorization_url) {
      await this.markOrderPaymentFailed(
        prepared.order.id,
        reference,
        initData.message ?? 'Failed to initialize Paystack transaction',
      );
      throw new BadRequestException(
        initData.message ?? 'Failed to initialize Paystack transaction',
      );
    }

    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { intentId: reference },
    });
    if (payment) {
      payment.status = PaymentStatus.AUTH_REQUIRED;
      payment.rawPayload = {
        ...(payment.rawPayload ?? {}),
        stage: 'paystack_initialized',
        initializeResponse: initData,
      };
      await this.dataSource.getRepository(Payment).save(payment);
    }

    return {
      orderId: prepared.order.id,
      reference,
      authorizationUrl: initData.data.authorization_url,
      status: 'AUTH_REQUIRED' as const,
      discountCents: prepared.discountCents,
      amountCents: paystackAmountCents,
      ...(dto.payInInstallments
        ? {
            payInInstallments: true,
            planTotalCents: prepared.chargeableCents,
            installmentSequence,
          }
        : {}),
    };
  }

  async confirmPaystackPayment(userId: string, reference: string) {
    if (!reference?.trim()) {
      throw new BadRequestException('reference is required');
    }
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { reference, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.confirmPaystackForOrder(order, reference);
  }

  /**
   * Confirm payment by Paystack reference only (guest buyers without a
   * session cookie on the Paystack return URL).
   */
  async confirmPaystackByReference(reference: string) {
    if (!reference?.trim()) {
      throw new BadRequestException('reference is required');
    }
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { reference },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.confirmPaystackForOrder(order, reference);
  }

  private async confirmPaystackForOrder(order: Order, reference: string) {
    const secret = this.getPaystackSecret();

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        reference?: string;
      };
    };

    if (!response.ok || !payload.status || !payload.data) {
      throw new BadRequestException(payload.message ?? 'Unable to verify payment');
    }

    if (payload.data.status !== 'success') {
      return { status: 'PENDING' as const, orderId: order.id, reference };
    }

    await this.finalizeSuccessfulPayment(reference, payload.data, 'confirm');
    const buyerUser = order.userId
      ? await this.dataSource.getRepository(User).findOne({
          where: { id: order.userId },
        })
      : null;
    return {
      status: 'PAID' as const,
      orderId: order.id,
      reference,
      buyerEmail: order.email,
      accountCreated: Boolean(buyerUser?.autoCreatedAt),
    };
  }

  private async findOrderForPaymentReference(
    orderId: string,
    reference: string,
  ): Promise<Order> {
    if (!orderId?.trim() || !reference?.trim()) {
      throw new BadRequestException('orderId and reference are required');
    }
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, reference: reference.trim() },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async getOrderSummaryByPaymentReference(orderId: string, reference: string) {
    const order = await this.findOrderForPaymentReference(orderId, reference);
    return this.getOrderSummaryForUser(order.userId!, order.id);
  }

  async resendTicketsByPaymentReference(orderId: string, reference: string) {
    const order = await this.findOrderForPaymentReference(orderId, reference);
    return this.resendTickets(order.userId!, order.id);
  }

  async processPaystackWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    body: unknown,
  ) {
    const secret =
      this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET') ||
      this.getPaystackSecret();
    if (!signature) {
      throw new UnauthorizedException('Missing Paystack signature');
    }

    const payloadString = rawBody
      ? rawBody.toString('utf8')
      : JSON.stringify(body ?? {});
    const expected = crypto
      .createHmac('sha512', secret)
      .update(payloadString)
      .digest('hex');
    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }

    const eventPayload = body as {
      event?: string;
      data?: { reference?: string; status?: string };
    };
    if (eventPayload.event !== 'charge.success' || !eventPayload.data?.reference) {
      return { received: true, ignored: true };
    }

    await this.finalizeSuccessfulPayment(
      eventPayload.data.reference,
      eventPayload.data,
      'webhook',
    );
    return { received: true, processed: true };
  }

  async resendTickets(userId: string, orderId: string) {
    const owned = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
    });
    if (!owned) {
      throw new NotFoundException('Order not found');
    }
    return this.resendTicketsForOrder(orderId);
  }

  /** Admin/support: resend ticket PDF after buyer email correction. */
  async adminResendOrderTickets(orderId: string) {
    return this.resendTicketsForOrder(orderId);
  }

  private async resendTicketsForOrder(orderId: string) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: [
        'event',
        'event.organizer',
        'items',
        'items.ticketType',
        'tickets',
        'tickets.ticketType',
      ],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Tickets can only be resent for paid orders');
    }
    if (!order.tickets?.length) {
      throw new NotFoundException('No tickets found for this order');
    }

    const buyerName = this.extractBuyerName(order.notes);
    const discountCents = order.discountCents ?? 0;
    const subtotalCents =
      (order.items ?? []).reduce(
        (acc, item) => acc + item.unitPriceCents * item.qty,
        0,
      ) || order.amountCents + discountCents;
    let couponCode: string | null = null;
    if (order.appliedCouponId) {
      const coupon = await this.dataSource
        .getRepository(Coupon)
        .findOne({ where: { id: order.appliedCouponId } });
      couponCode = coupon?.code ?? null;
    }
    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { orderId: order.id, status: PaymentStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });
    const rawPayload = (payment?.rawPayload ?? {}) as {
      receiptEmailSentAt?: string;
    };
    if (payment && !rawPayload.receiptEmailSentAt) {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL')?.trim() ||
        'http://localhost:3000';
      await this.sendOrderPaymentReceiptEmail(order, order.event ?? null, {
        paymentReference: payment.intentId,
        paidAt: this.resolveGatewayPaidAt(
          (payment.rawPayload?.gatewayPayload as Record<string, unknown>) ??
            payment.rawPayload ??
            {},
        ),
        amountCents: payment.amountCents,
        currency: payment.currency,
        paymentMethodLabel: this.resolveGatewayPaymentMethodLabel(
          (payment.rawPayload?.gatewayPayload as Record<string, unknown>) ??
            payment.rawPayload ??
            {},
        ),
        orderConfirmationUrl: `${frontendUrl.replace(/\/$/, '')}/orders/${order.id}/confirmation`,
        ticketsPending: false,
        organizerName:
          order.event?.organizer?.orgName ??
          this.configService.get<string>('APP_NAME', 'All AXS'),
        organizerSupportEmail: order.event?.organizer?.supportEmail ?? null,
      });
      payment.rawPayload = {
        ...(payment.rawPayload ?? {}),
        receiptEmailSentAt: new Date().toISOString(),
      };
      await this.dataSource.getRepository(Payment).save(payment);
    }

    const summary = await this.resolveOrderEmailSummary(order.id);
    const accessUrl = await this.resolveBuyerAccessUrl(order);
    await this.sendOrderTicketEmail(order, order.event ?? null, order.tickets, {
      ...summary,
      accessUrl,
      accountCreated: summary.accountCreated,
    });

    return { resent: true };
  }

  async resendReceipt(userId: string, orderId: string) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: ['event', 'event.organizer'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.REFUNDED) {
      throw new BadRequestException(
        'Receipts can only be resent for paid or refunded orders',
      );
    }
    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { orderId: order.id, status: PaymentStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });
    if (!payment) {
      throw new NotFoundException('No successful payment found for this order');
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3000';
    await this.sendOrderPaymentReceiptEmail(order, order.event ?? null, {
      paymentReference: payment.intentId,
      paidAt: this.resolveGatewayPaidAt(
        (payment.rawPayload?.gatewayPayload as Record<string, unknown>) ??
          payment.rawPayload ??
          {},
      ),
      amountCents: payment.amountCents,
      currency: payment.currency,
      paymentMethodLabel: this.resolveGatewayPaymentMethodLabel(
        (payment.rawPayload?.gatewayPayload as Record<string, unknown>) ??
          payment.rawPayload ??
          {},
      ),
      orderConfirmationUrl: `${frontendUrl.replace(/\/$/, '')}/orders/${order.id}/confirmation`,
      ticketsPending: false,
      organizerName:
        order.event?.organizer?.orgName ??
        this.configService.get<string>('APP_NAME', 'All AXS'),
      organizerSupportEmail: order.event?.organizer?.supportEmail ?? null,
    });

    payment.rawPayload = {
      ...(payment.rawPayload ?? {}),
      receiptEmailSentAt: new Date().toISOString(),
    };
    await this.dataSource.getRepository(Payment).save(payment);

    return { resent: true };
  }

  async listOrdersForUser(userId: string, limit: number, offset: number) {
    const repo = this.dataSource.getRepository(Order);
    const [orders, total] = await repo.findAndCount({
      where: { userId },
      relations: ['event', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const visible = orders.filter((o) => o.status !== OrderStatus.DRAFT);

    return {
      orders: visible.map((order) => {
        const payment = [...(order.payments ?? [])]
          .filter((p) => p.status === PaymentStatus.SUCCESS)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
        return {
          id: order.id,
          status: order.status,
          totalCents: order.amountCents,
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          eventId: order.eventId,
          eventTitle: order.event?.title ?? 'Event',
          eventSlug: order.event?.slug ?? '',
          eventStartAt: order.event?.startAt?.toISOString() ?? null,
          eventEndAt: order.event?.endAt?.toISOString() ?? null,
          ticketCount: order.tickets?.length ?? 0,
          paymentReference: payment?.intentId ?? null,
        };
      }),
      total,
      limit,
      offset,
    };
  }

  private resolveInstallmentSequence(
    payment: Payment,
    installments: PaymentInstallment[],
  ): number {
    const raw = (payment.rawPayload ?? {}) as {
      installmentSequence?: number;
    };
    if (typeof raw.installmentSequence === 'number' && raw.installmentSequence > 0) {
      return raw.installmentSequence;
    }
    const nextPending = [...installments]
      .filter((i) => i.status === PaymentInstallmentStatus.PENDING)
      .sort((a, b) => a.sequence - b.sequence)[0];
    return nextPending?.sequence ?? 1;
  }

  private async finalizeSuccessfulPayment(
    reference: string,
    gatewayPayload: Record<string, unknown>,
    source: 'webhook' | 'confirm' | 'free_order',
  ) {
    const tx = await this.dataSource.transaction(async (manager) => {
      // Lock payment + order rows only. PostgreSQL rejects FOR UPDATE on
      // LEFT JOINed relations ("nullable side of an outer join").
      const payment = await manager.findOne(Payment, {
        where: { intentId: reference },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      await manager.findOne(Order, {
        where: { id: payment.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      const order = await manager.findOne(Order, {
        where: { id: payment.orderId },
        relations: [
          'items',
          'items.ticketType',
          'event',
          'event.organizer',
          'paymentPlans',
          'paymentPlans.installments',
        ],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      payment.order = order;
      if (order.status === OrderStatus.PAID && payment.status === PaymentStatus.SUCCESS) {
        return {
          order,
          issuedTickets: [] as Ticket[],
          paymentIntentId: reference,
          installmentSequence: null as number | null,
        };
      }

      const plan = order.paymentPlans?.[0];
      const installments = plan?.installments ?? [];
      if (plan && order.status !== OrderStatus.PAID) {
        const sequence = this.resolveInstallmentSequence(payment, installments);
        const installment = installments.find((i) => i.sequence === sequence);
        if (installment?.status === PaymentInstallmentStatus.PAID) {
          if (payment.status !== PaymentStatus.SUCCESS) {
            payment.status = PaymentStatus.SUCCESS;
            payment.rawPayload = {
              ...(payment.rawPayload ?? {}),
              finalizedBy: source,
              gatewayPayload,
            };
            await manager.save(payment);
          }
          return {
            order,
            issuedTickets: [] as Ticket[],
            paymentIntentId: reference,
            installmentSequence: null,
          };
        }
        if (installment && payment.amountCents !== installment.amount) {
          throw new BadRequestException(
            'Payment amount does not match installment due',
          );
        }

        payment.status = PaymentStatus.SUCCESS;
        const paystackId =
          typeof gatewayPayload.id === 'number'
            ? gatewayPayload.id
            : typeof gatewayPayload.id === 'string' &&
                /^\d+$/.test(gatewayPayload.id)
              ? Number.parseInt(gatewayPayload.id, 10)
              : undefined;
        payment.rawPayload = {
          ...(payment.rawPayload ?? {}),
          finalizedBy: source,
          gatewayPayload,
          installmentSequence: sequence,
          ...(paystackId !== undefined ? { paystackTransactionId: paystackId } : {}),
        };
        await manager.save(payment);

        return {
          order,
          issuedTickets: [] as Ticket[],
          paymentIntentId: reference,
          installmentSequence: sequence,
        };
      }

      for (const item of order.items ?? []) {
        const tier = await manager.findOne(TicketType, {
          where: { id: item.ticketTypeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!tier) continue;
        const remaining = tier.quantityTotal - tier.quantitySold;
        if (remaining < item.qty) {
          throw new BadRequestException(`Insufficient inventory for ${tier.name}`);
        }
        tier.quantitySold += item.qty;
        await manager.save(tier);
      }

      const existingCount = await manager.count(Ticket, {
        where: { orderId: order.id },
      });
      const issuedTickets: Ticket[] = [];
      if (existingCount === 0) {
        const buyerName = this.extractBuyerName(order.notes);
        const secret =
          this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
        for (const item of order.items ?? []) {
          for (let i = 0; i < item.qty; i++) {
            const qrNonce = `qr_${crypto.randomUUID().replace(/-/g, '')}`;
            const ticket = manager.create(Ticket, {
              orderId: order.id,
              ticketTypeId: item.ticketTypeId,
              ownerUserId: order.userId ?? null,
              attendeeName: buyerName,
              attendeeEmail: order.email,
              attendeePhone: order.phone,
              qrNonce,
              qrSignature: '',
            });
            await manager.save(ticket);
            const sig = crypto
              .createHmac('sha256', secret)
              .update(`${ticket.id}:${qrNonce}`)
              .digest('hex');
            ticket.qrSignature = sig;
            await manager.save(ticket);
            issuedTickets.push(ticket);
          }
        }
      }

      order.status = OrderStatus.PAID;
      await manager.save(order);
      payment.status = PaymentStatus.SUCCESS;
      const paystackId =
        typeof gatewayPayload.id === 'number'
          ? gatewayPayload.id
          : typeof gatewayPayload.id === 'string' && /^\d+$/.test(gatewayPayload.id)
            ? Number.parseInt(gatewayPayload.id, 10)
            : undefined;
      payment.rawPayload = {
        ...(payment.rawPayload ?? {}),
        finalizedBy: source,
        gatewayPayload,
        ...(paystackId !== undefined ? { paystackTransactionId: paystackId } : {}),
      };
      await manager.save(payment);

      const eventEntity = order.event;
      const organizerId =
        eventEntity?.organizer?.id ??
        (eventEntity as Event & { organizerId?: string })?.organizerId;
      if (organizerId) {
        await this.organizerLedgerService.ensureOrderEarnings(
          manager,
          order,
          organizerId,
        );
      }

      return {
        order,
        issuedTickets,
        paymentIntentId: reference,
        installmentSequence: null,
      };
    });

    if (tx.installmentSequence !== null) {
      const installmentResult = await this.paymentPlansService.markInstallmentPaid(
        tx.order.id,
        tx.installmentSequence,
      );
      const event = await this.dataSource.getRepository(Event).findOne({
        where: { id: installmentResult.order.eventId },
        relations: ['organizer'],
      });
      if (installmentResult.order.status === OrderStatus.PAID) {
        const organizerId =
          event?.organizer?.id ??
          (event as Event & { organizerId?: string })?.organizerId;
        if (organizerId) {
          await this.dataSource.transaction(async (manager) =>
            this.organizerLedgerService.ensureOrderEarnings(
              manager,
              installmentResult.order,
              organizerId,
            ),
          );
        }
      }
      const fullTickets = await this.dataSource.getRepository(Ticket).find({
        where: { orderId: installmentResult.order.id },
        relations: ['ticketType'],
      });
      const allPaid = installmentResult.order.status === OrderStatus.PAID;
      try {
        await this.deliverPaidOrderEmails({
          order: installmentResult.order,
          event,
          tickets: allPaid ? fullTickets : [],
          paymentIntentId: tx.paymentIntentId,
          gatewayPayload,
          sendTickets: allPaid && fullTickets.length > 0,
          installmentNote: allPaid
            ? null
            : `Installment ${tx.installmentSequence} received`,
        });
      } catch (error) {
        this.logger.error(
          `Post-payment emails failed for order ${installmentResult.order.id}: ${String(error)}`,
        );
      }
      return;
    }

    if (tx.issuedTickets.length > 0) {
      try {
        const event = await this.dataSource.getRepository(Event).findOne({
          where: { id: tx.order.eventId },
          relations: ['organizer'],
        });
        const fullTickets = await this.dataSource.getRepository(Ticket).find({
          where: { orderId: tx.order.id },
          relations: ['ticketType'],
        });
        await this.deliverPaidOrderEmails({
          order: tx.order,
          event,
          tickets: fullTickets,
          paymentIntentId: tx.paymentIntentId,
          gatewayPayload,
          sendTickets: fullTickets.length > 0,
        });
      } catch (error) {
        this.logger.error(
          `Post-payment emails failed for order ${tx.order.id}: ${String(error)}`,
        );
      }
    }
  }

  private async markOrderPaymentFailed(
    orderId: string,
    reference: string,
    reason: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (order) {
        order.status = OrderStatus.FAILED;
        await manager.save(order);
      }
      const payment = await manager.findOne(Payment, {
        where: { intentId: reference },
      });
      if (payment) {
        payment.status = PaymentStatus.FAILED;
        payment.rawPayload = { reason };
        await manager.save(payment);
      }
    });
  }

  private async deliverPaidOrderEmails(input: {
    order: Order;
    event: Event | null;
    tickets: Ticket[];
    paymentIntentId: string;
    gatewayPayload: Record<string, unknown>;
    sendTickets: boolean;
    installmentNote?: string | null;
  }): Promise<void> {
    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { intentId: input.paymentIntentId },
    });
    const rawPayload = (payment?.rawPayload ?? {}) as {
      receiptEmailSentAt?: string;
      ticketEmailSentAt?: string;
    };

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3000';
    const orderConfirmationUrl = `${frontendUrl.replace(/\/$/, '')}/orders/${input.order.id}/confirmation`;
    const organizerName =
      input.event?.organizer?.orgName ??
      this.configService.get<string>('APP_NAME', 'All AXS');
    const organizerSupportEmail = input.event?.organizer?.supportEmail ?? null;

    if (!rawPayload.receiptEmailSentAt) {
      const receiptSent = await this.sendOrderPaymentReceiptEmail(
        input.order,
        input.event,
        {
          paymentReference: input.paymentIntentId,
          paidAt: this.resolveGatewayPaidAt(input.gatewayPayload),
          amountCents: payment?.amountCents ?? input.order.amountCents,
          currency: payment?.currency ?? input.order.currency,
          paymentMethodLabel: this.resolveGatewayPaymentMethodLabel(
            input.gatewayPayload,
          ),
          orderConfirmationUrl,
          ticketsPending: input.sendTickets && input.tickets.length > 0,
          installmentNote: input.installmentNote,
          organizerName,
          organizerSupportEmail,
        },
      );
      if (receiptSent && payment) {
        payment.rawPayload = {
          ...(payment.rawPayload ?? {}),
          receiptEmailSentAt: new Date().toISOString(),
        };
        await this.dataSource.getRepository(Payment).save(payment);
      }
    }

    if (input.sendTickets && input.tickets.length > 0 && !rawPayload.ticketEmailSentAt) {
      const summary = await this.resolveOrderEmailSummary(input.order.id);
      const accessUrl = await this.resolveBuyerAccessUrl(input.order);
      const ticketSent = await this.sendOrderTicketEmail(
        input.order,
        input.event,
        input.tickets,
        {
          ...summary,
          accessUrl,
          accountCreated: summary.accountCreated,
        },
      );
      if (ticketSent && payment) {
        const freshPayment = await this.dataSource.getRepository(Payment).findOne({
          where: { intentId: input.paymentIntentId },
        });
        if (freshPayment) {
          freshPayment.rawPayload = {
            ...(freshPayment.rawPayload ?? {}),
            ticketEmailSentAt: new Date().toISOString(),
          };
          await this.dataSource.getRepository(Payment).save(freshPayment);
        }
      }
    }
  }

  private async resolveOrderEmailSummary(orderId: string): Promise<{
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    currency: string;
    couponCode: string | null;
    accountCreated: boolean;
  }> {
    const freshOrder = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!freshOrder) {
      throw new NotFoundException('Order not found');
    }
    const discountCents = freshOrder.discountCents ?? 0;
    const subtotalCents =
      (freshOrder.items ?? []).reduce(
        (acc, item) => acc + item.unitPriceCents * item.qty,
        0,
      ) || freshOrder.amountCents + discountCents;
    let couponCode: string | null = null;
    if (freshOrder.appliedCouponId) {
      const coupon = await this.dataSource
        .getRepository(Coupon)
        .findOne({ where: { id: freshOrder.appliedCouponId } });
      couponCode = coupon?.code ?? null;
    }
    const buyerUser = freshOrder.userId
      ? await this.dataSource.getRepository(User).findOne({
          where: { id: freshOrder.userId },
        })
      : null;

    return {
      subtotalCents,
      discountCents,
      totalCents: freshOrder.amountCents,
      currency: freshOrder.currency,
      couponCode,
      accountCreated: Boolean(buyerUser?.autoCreatedAt),
    };
  }

  private async resolveBuyerAccessUrl(order: Order): Promise<string | undefined> {
    if (!order.userId) return undefined;
    try {
      return await this.authService.buildCheckoutAccessUrl(order.userId);
    } catch (linkErr) {
      this.logger.warn(
        `Checkout access link failed for order ${order.id}: ${String(linkErr)}`,
      );
      return undefined;
    }
  }

  private resolveGatewayPaidAt(
    gatewayPayload: Record<string, unknown>,
  ): Date {
    const raw =
      gatewayPayload.paid_at ??
      gatewayPayload.paidAt ??
      gatewayPayload.transaction_date;
    if (typeof raw === 'string' || typeof raw === 'number') {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }

  private resolveGatewayPaymentMethodLabel(
    gatewayPayload: Record<string, unknown>,
  ): string | null {
    const channel =
      typeof gatewayPayload.channel === 'string'
        ? gatewayPayload.channel.toLowerCase()
        : null;
    const authorization =
      gatewayPayload.authorization &&
      typeof gatewayPayload.authorization === 'object'
        ? (gatewayPayload.authorization as Record<string, unknown>)
        : undefined;
    const last4 =
      typeof authorization?.last4 === 'string'
        ? authorization.last4
        : typeof authorization?.last_4 === 'string'
          ? authorization.last_4
          : null;
    const brand =
      typeof authorization?.brand === 'string'
        ? authorization.brand
        : typeof authorization?.card_type === 'string'
          ? authorization.card_type
          : null;

    if (channel === 'mobile_money' || channel === 'mpesa') {
      return last4 ? `M-PESA ···· ${last4}` : 'M-PESA';
    }
    if (channel === 'card') {
      if (brand && last4) {
        return `${brand.toUpperCase()} ···· ${last4}`;
      }
      return 'Card';
    }
    if (channel) {
      return channel.replace(/_/g, ' ');
    }
    return null;
  }

  private async sendOrderPaymentReceiptEmail(
    order: Order,
    event: Event | null,
    input: {
      paymentReference: string;
      paidAt: Date;
      amountCents: number;
      currency: string;
      paymentMethodLabel: string | null;
      orderConfirmationUrl: string;
      ticketsPending: boolean;
      installmentNote?: string | null;
      organizerName: string;
      organizerSupportEmail: string | null;
    },
  ): Promise<boolean> {
    const notification =
      await this.notificationsService.dispatchPaymentReceiptEmail(
        {
          buyerEmail: order.email,
          buyerName: this.extractBuyerName(order.notes),
          organizerName: input.organizerName,
          organizerSupportEmail: input.organizerSupportEmail,
          eventTitle: event?.title ?? 'Event',
          paymentReference: input.paymentReference,
          orderReference: order.reference ?? order.id,
          paidAt: input.paidAt,
          amountCents: input.amountCents,
          currency: input.currency,
          paymentMethodLabel: input.paymentMethodLabel,
          orderConfirmationUrl: input.orderConfirmationUrl,
          ticketsPending: input.ticketsPending,
          installmentNote: input.installmentNote,
        },
        { transactional: true },
      );
    if (!notification) return false;
    if (notification.status === NotifyStatus.FAILED) {
      throw new Error(
        notification.error ?? 'Payment receipt email dispatch failed',
      );
    }
    return notification.status === NotifyStatus.SENT;
  }

  private async sendOrderTicketEmail(
    order: Order,
    event: Event | null,
    tickets: Ticket[],
    summary: {
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      currency: string;
      couponCode?: string | null;
      accessUrl?: string;
      accountCreated?: boolean;
    },
  ): Promise<boolean> {
    const notification = await this.notificationsService.enqueueTicketEmail(
      {
        buyerName: this.extractBuyerName(order.notes),
        buyerEmail: order.email,
        eventTitle: event?.title ?? 'Event',
        event: eventToEmailContext(event, event?.organizer?.orgName),
        tickets: ticketsFromEntities(tickets, (t) => t.ticketType?.name ?? 'Ticket'),
        summary: {
          subtotalCents: summary.subtotalCents,
          discountCents: summary.discountCents,
          totalCents: summary.totalCents,
          currency: summary.currency,
          couponCode: summary.couponCode,
        },
        accessUrl: summary.accessUrl,
        accountCreated: summary.accountCreated,
      },
      { transactional: true },
    );
    if (!notification) return false;
    const outcome = await this.notificationsService.processNotification(
      notification.id,
    );
    if (outcome === 'failed') {
      throw new Error('Ticket email dispatch failed');
    }
    const sent = outcome === 'sent';
    await this.sendOrderTicketDeliverySms({
      order,
      eventTitle: event?.title ?? 'Event',
      tickets,
      accessUrl: summary.accessUrl,
      buyerName: this.extractBuyerName(order.notes),
    });
    await this.sendOrderTicketWhatsApp({
      order,
      eventTitle: event?.title ?? 'Event',
      tickets,
      buyerName: this.extractBuyerName(order.notes),
    });
    return sent;
  }

  private async sendOrderTicketWhatsApp(input: {
    order: Order;
    eventTitle: string;
    tickets: Ticket[];
    buyerName?: string;
  }): Promise<void> {
    const meta = parseOrderNotes(input.order.notes);
    if (!shouldSendTicketWhatsApp(meta, input.order.phone)) {
      return;
    }

    try {
      const notification = await this.notificationsService.enqueueTicketWhatsApp({
        phone: input.order.phone!,
        buyerName: input.buyerName ?? meta.buyerName ?? '',
        eventTitle: input.eventTitle,
        tickets: input.tickets.map((t) => ({
          id: t.id,
          qrNonce: t.qrNonce,
          qrSignature: t.qrSignature,
        })),
        orderId: input.order.id,
      });
      if (notification) {
        await this.notificationsService.processNotification(notification.id);
      }
    } catch (error) {
      this.logger.warn(
        `Ticket delivery WhatsApp failed for order ${input.order.id}: ${String(error)}`,
      );
    }
  }

  private async sendOrderTicketDeliverySms(input: {
    order: Order;
    eventTitle: string;
    tickets: Ticket[];
    accessUrl?: string;
    buyerName?: string;
  }): Promise<void> {
    const phone = input.order.phone?.trim();
    if (!phone) return;

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3000';
    const deepLink =
      input.accessUrl ??
      (input.tickets.length === 1
        ? `${frontendUrl}/tickets/${input.tickets[0].id}`
        : `${frontendUrl}/tickets`);

    try {
      await this.notificationsService.sendTicketDeliverySms({
        phone,
        eventTitle: input.eventTitle,
        deepLink,
        buyerName: input.buyerName,
        ticketCount: input.tickets.length,
      });
    } catch (error) {
      this.logger.warn(
        `Ticket delivery SMS failed for order ${input.order.id}: ${String(error)}`,
      );
    }
  }

  private extractBuyerName(notes: string | undefined): string {
    if (!notes) return '';
    try {
      const parsed = JSON.parse(notes) as { buyerName?: string };
      return parsed.buyerName ?? '';
    } catch {
      return '';
    }
  }

  private getPaystackSecret(): string {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new BadRequestException('PAYSTACK_SECRET_KEY is not configured');
    }
    return secret;
  }

  private getPaystackCallbackUrl(): string {
    const callback = this.configService.get<string>('PAYSTACK_CALLBACK_URL');
    if (callback?.trim()) return callback.trim();
    const frontend = this.configService.get<string>('FRONTEND_URL');
    return `${frontend || 'http://localhost:3000'}/orders/payment/callback`;
  }

  async getOrderSummaryForUser(
    userId: string,
    orderId: string,
  ): Promise<{
    order: {
      id: string;
      status: OrderStatus;
      eventId: string;
      totalCents: number;
      subtotalCents: number;
      discountCents: number;
      feesCents: number;
      organizerNetCents: number;
      currency: string;
      eventTitle: string;
      eventSlug: string;
      eventStartAt: string | null;
      eventEndAt: string | null;
      createdAt: string;
      paymentReference: string | null;
      buyerName: string;
      buyerEmail: string;
      guestCheckout: boolean;
      accountAutoCreated: boolean;
      coupon: { code: string; discountCents: number } | null;
      lineItems: {
        ticketTypeId: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        currency: string;
      }[];
    };
    paymentPlan: {
      status: PaymentPlanStatus;
      totalAmount: number;
      currency: string;
      nextDueAt: string | null;
      installments: {
        sequence: number;
        amount: number;
        pct: number;
        dueAt: string;
        status: PaymentInstallmentStatus;
        paidAt: string | null;
      }[];
    } | null;
  }> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: [
        'event',
        'items',
        'items.ticketType',
        'appliedCoupon',
        'payments',
        'paymentPlans',
        'paymentPlans.installments',
      ],
    });
    if (!order || !order.event) {
      throw new NotFoundException('Order not found');
    }

    const notesMeta = parseOrderNotes(order.notes);
    const buyerName = notesMeta.buyerName ?? '';
    const buyerUser = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
    });

    const lineItems = (order.items ?? []).map((item) => ({
      ticketTypeId: item.ticketTypeId,
      name: item.ticketType?.name ?? 'Ticket',
      quantity: item.qty,
      unitPriceCents: item.unitPriceCents,
      currency: item.currency,
    }));

    const fees = order.feesCents ?? 0;
    const discount = order.discountCents ?? 0;
    // Subtotal = gross (pre-discount) total. We compute it from line items so it
    // remains correct even if `amountCents` is the buyer-paid (net) value.
    const subtotalCents = lineItems.reduce(
      (acc, li) => acc + li.unitPriceCents * li.quantity,
      0,
    );
    const coupon = order.appliedCoupon
      ? { code: order.appliedCoupon.code, discountCents: discount }
      : null;
    const payment = [...(order.payments ?? [])]
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    const plan = order.paymentPlans?.[0];
    const paymentPlan = plan
      ? {
          status: plan.status,
          totalAmount: plan.totalAmount,
          currency: plan.currency,
          nextDueAt: plan.nextDueAt?.toISOString() ?? null,
          installments: [...(plan.installments ?? [])]
            .sort((a, b) => a.sequence - b.sequence)
            .map((inst) => ({
              sequence: inst.sequence,
              amount: inst.amount,
              pct: Number(inst.pct),
              dueAt: inst.dueAt.toISOString(),
              status: inst.status,
              paidAt: inst.paidAt?.toISOString() ?? null,
            })),
        }
      : null;

    return {
      order: {
        id: order.id,
        status: order.status,
        eventId: order.eventId,
        totalCents: order.amountCents,
        subtotalCents,
        discountCents: discount,
        feesCents: fees,
        organizerNetCents: Math.max(0, order.amountCents - fees),
        currency: order.currency,
        eventTitle: order.event.title,
        eventSlug: order.event.slug,
        eventStartAt: order.event.startAt?.toISOString() ?? null,
        eventEndAt: order.event.endAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        paymentReference: payment?.intentId ?? null,
        buyerName,
        buyerEmail: order.email,
        guestCheckout: notesMeta.guestCheckout === true,
        accountAutoCreated: Boolean(buyerUser?.autoCreatedAt),
        coupon,
        lineItems,
      },
      paymentPlan,
    };
  }

  async initializeInstallmentPayment(userId: string, orderId: string) {
    await this.authService.assertEmailVerifiedForCheckout(userId);

    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const plan = await this.paymentPlansService.findByOrder(orderId);
    if (!plan || plan.status !== PaymentPlanStatus.ACTIVE) {
      throw new BadRequestException('No active payment plan for this order');
    }

    const nextInstallment = [...(plan.installments ?? [])]
      .filter((i) => i.status === PaymentInstallmentStatus.PENDING)
      .sort((a, b) => a.sequence - b.sequence)[0];
    if (!nextInstallment) {
      throw new BadRequestException('No pending installment to pay');
    }

    const reference = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
    const callbackUrl = this.getPaystackCallbackUrl();
    const secret = this.getPaystackSecret();

    await this.dataSource.getRepository(Payment).save(
      this.dataSource.getRepository(Payment).create({
        orderId: order.id,
        gateway: PaymentGateway.PAYSTACK,
        intentId: reference,
        status: PaymentStatus.INITIATED,
        amountCents: nextInstallment.amount,
        currency: order.currency,
        txRef: reference,
        rawPayload: {
          stage: 'initialized_locally',
          orderId: order.id,
          payInInstallments: true,
          installmentSequence: nextInstallment.sequence,
        },
      }),
    );

    const initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: order.email,
        amount: nextInstallment.amount,
        currency: order.currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          orderId: order.id,
          userId,
          eventId: order.eventId,
          payInInstallments: true,
          installmentSequence: nextInstallment.sequence,
        },
      }),
    });

    const initData = (await initResponse.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    };

    if (!initResponse.ok || !initData.status || !initData.data?.authorization_url) {
      const payment = await this.dataSource.getRepository(Payment).findOne({
        where: { intentId: reference },
      });
      if (payment) {
        payment.status = PaymentStatus.FAILED;
        payment.rawPayload = {
          ...(payment.rawPayload ?? {}),
          reason: initData.message ?? 'Failed to initialize Paystack transaction',
        };
        await this.dataSource.getRepository(Payment).save(payment);
      }
      throw new BadRequestException(
        initData.message ?? 'Failed to initialize Paystack transaction',
      );
    }

    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { intentId: reference },
    });
    if (payment) {
      payment.status = PaymentStatus.AUTH_REQUIRED;
      payment.rawPayload = {
        ...(payment.rawPayload ?? {}),
        stage: 'paystack_initialized',
        initializeResponse: initData,
      };
      await this.dataSource.getRepository(Payment).save(payment);
    }

    return {
      authorizationUrl: initData.data.authorization_url,
      reference,
      amountCents: nextInstallment.amount,
      installmentSequence: nextInstallment.sequence,
    };
  }
}
