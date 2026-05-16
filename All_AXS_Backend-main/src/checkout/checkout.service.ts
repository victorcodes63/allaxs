import {
  BadRequestException,
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
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  TicketTypeStatus,
} from '../domain/enums';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';
import { PaystackInitDto } from './dto/paystack-init.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';
import { EmailService } from '../auth/services/email.service';
import {
  eventToEmailContext,
  ticketsFromEntities,
} from '../tickets/ticket-email.util';
import { computePlatformFeeCents } from './platform-fee.util';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { CouponsService } from '../events/coupons.service';
import { Coupon } from '../events/entities/coupon.entity';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly organizerLedgerService: OrganizerLedgerService,
    private readonly couponsService: CouponsService,
  ) {}

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
        if (tier.status !== TicketTypeStatus.ACTIVE) {
          throw new BadRequestException(`Ticket type ${tier.name} is not on sale`);
        }
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
        notes: JSON.stringify({ demo: true, buyerName: dto.buyerName }),
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

  async initializePaystackCheckout(userId: string, dto: PaystackInitDto) {
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
        if (tier.status !== TicketTypeStatus.ACTIVE) {
          throw new BadRequestException(`Ticket type ${tier.name} is not on sale`);
        }
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
        notes: JSON.stringify({ buyerName: dto.buyerName }),
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
      };
    });

    // 100%-off coupon path (COUPONS_SPEC §6). Skip Paystack entirely
    // and finalize the order in-band so tickets + emails get issued
    // the same way `processPaystackWebhook` would have.
    if (prepared.chargeableCents === 0) {
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
        amount: prepared.chargeableCents,
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
      amountCents: prepared.chargeableCents,
    };
  }

  async confirmPaystackPayment(userId: string, reference: string) {
    if (!reference?.trim()) {
      throw new BadRequestException('reference is required');
    }
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

    const order = await this.dataSource.getRepository(Order).findOne({
      where: { reference, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (payload.data.status !== 'success') {
      return { status: 'PENDING', orderId: order.id, reference };
    }

    await this.finalizeSuccessfulPayment(reference, payload.data, 'confirm');
    return { status: 'PAID', orderId: order.id, reference };
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
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
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
    await this.sendOrderTicketEmail(order, order.event ?? null, order.tickets, {
      subtotalCents,
      discountCents,
      totalCents: order.amountCents,
      currency: order.currency,
      couponCode,
    });

    return { resent: true };
  }

  private async finalizeSuccessfulPayment(
    reference: string,
    gatewayPayload: Record<string, unknown>,
    source: 'webhook' | 'confirm' | 'free_order',
  ) {
    const tx = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { intentId: reference },
        relations: [
          'order',
          'order.items',
          'order.items.ticketType',
          'order.event',
          'order.event.organizer',
        ],
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || !payment.order) {
        throw new NotFoundException('Payment not found');
      }

      await manager.findOne(Order, {
        where: { id: payment.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      const order = payment.order;
      if (order.status === OrderStatus.PAID && payment.status === PaymentStatus.SUCCESS) {
        return { order, issuedTickets: [] as Ticket[], paymentIntentId: reference };
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

      return { order, issuedTickets, paymentIntentId: reference };
    });

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
        const freshOrder = await this.dataSource.getRepository(Order).findOne({
          where: { id: tx.order.id },
          relations: ['items'],
        });
        const discountCents = freshOrder?.discountCents ?? 0;
        const subtotalCents =
          (freshOrder?.items ?? []).reduce(
            (acc, item) => acc + item.unitPriceCents * item.qty,
            0,
          ) || (freshOrder?.amountCents ?? tx.order.amountCents) + discountCents;
        let couponCode: string | null = null;
        if (freshOrder?.appliedCouponId) {
          const coupon = await this.dataSource
            .getRepository(Coupon)
            .findOne({ where: { id: freshOrder.appliedCouponId } });
          couponCode = coupon?.code ?? null;
        }
        await this.sendOrderTicketEmail(tx.order, event, fullTickets, {
          subtotalCents,
          discountCents,
          totalCents: freshOrder?.amountCents ?? tx.order.amountCents,
          currency: freshOrder?.currency ?? tx.order.currency,
          couponCode,
        });
        const payRepo = this.dataSource.getRepository(Payment);
        const p = await payRepo.findOne({ where: { intentId: tx.paymentIntentId } });
        if (p) {
          p.rawPayload = {
            ...(p.rawPayload ?? {}),
            ticketEmailSentAt: new Date().toISOString(),
          };
          await payRepo.save(p);
        }
      } catch (error) {
        this.logger.error(
          `Ticket email send failed for order ${tx.order.id}: ${String(error)}`,
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
    },
  ): Promise<void> {
    await this.emailService.sendTicketEmail({
      buyerName: this.extractBuyerName(order.notes),
      buyerEmail: order.email,
      eventTitle: event?.title ?? 'Event',
      event: eventToEmailContext(event, event?.organizer?.orgName),
      tickets: ticketsFromEntities(tickets, (t) => t.ticketType?.name ?? 'Ticket'),
      summary,
    });
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
      buyerName: string;
      buyerEmail: string;
      coupon: { code: string; discountCents: number } | null;
      lineItems: {
        ticketTypeId: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        currency: string;
      }[];
    };
  }> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: ['event', 'items', 'items.ticketType', 'appliedCoupon'],
    });
    if (!order || !order.event) {
      throw new NotFoundException('Order not found');
    }

    let buyerName = '';
    try {
      const meta = JSON.parse(order.notes || '{}') as { buyerName?: string };
      buyerName = meta.buyerName ?? '';
    } catch {
      buyerName = '';
    }

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
        buyerName,
        buyerEmail: order.email,
        coupon,
        lineItems,
      },
    };
  }
}
