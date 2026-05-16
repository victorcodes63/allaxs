import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Order } from '../domain/order.entity';
import { Payment } from '../domain/payment.entity';
import { Ticket } from '../domain/ticket.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import {
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  TicketStatus,
} from '../domain/enums';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { Event } from '../events/entities/event.entity';
import { CouponsService } from '../events/coupons.service';

type PaystackRefundResponse = {
  status?: boolean;
  message?: string;
  data?: { id?: number; transaction?: { id?: number; reference?: string } };
};

@Injectable()
export class OrderRefundService {
  private readonly logger = new Logger(OrderRefundService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly organizerLedgerService: OrganizerLedgerService,
    private readonly couponsService: CouponsService,
  ) {}

  /**
   * Refunds a paid order: optional Paystack reversal, restores tier inventory,
   * voids tickets, marks order and primary payment refunded.
   */
  async refundPaidOrder(
    orderId: string,
    body: { reason?: string },
  ): Promise<{
    order: {
      id: string;
      status: OrderStatus;
      previousStatus: OrderStatus;
      refundAmountCents: number;
      originalAmountCents: number;
      currency: string;
      paystackRefundSkipped?: boolean;
      paystackRefundId?: number;
    };
  }> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['items', 'tickets', 'payments', 'event', 'event.organizer'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Order is already refunded');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    const refundAmount = order.amountCents;

    const tickets = order.tickets ?? [];
    const checkedIn = tickets.some((t) => t.status === TicketStatus.CHECKED_IN);
    if (checkedIn) {
      throw new BadRequestException(
        'Cannot refund: at least one ticket has already been checked in.',
      );
    }

    const isDemoReference = (order.reference ?? '').startsWith('demo_');
    const successPayment = (order.payments ?? []).find(
      (p) =>
        p.gateway === PaymentGateway.PAYSTACK &&
        p.status === PaymentStatus.SUCCESS,
    );

    let paystackRefundSkipped = false;
    let paystackRefundId: number | undefined;

    if (!isDemoReference) {
      if (!successPayment) {
        throw new BadRequestException(
          'No successful Paystack payment found for this order.',
        );
      }
      const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      if (!secret) {
        throw new BadRequestException(
          'PAYSTACK_SECRET_KEY is not configured; cannot refund card payments.',
        );
      }
      const raw = successPayment.rawPayload as
        | { paystackTransactionId?: number }
        | undefined;
      const txId = raw?.paystackTransactionId;
      const transaction =
        typeof txId === 'number' && Number.isFinite(txId)
          ? txId
          : (order.reference ?? successPayment.intentId ?? '').trim();
      if (!transaction) {
        throw new BadRequestException('Missing Paystack transaction reference on order');
      }

      const refundResult = await this.callPaystackRefund(secret, transaction);
      paystackRefundId = refundResult.refundId;
    } else {
      paystackRefundSkipped = true;
      this.logger.log(`Skipping Paystack refund for demo order ${order.id}`);
    }

    const previousStatus = order.status;

    await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'tickets', 'payments', 'event', 'event.organizer'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!fresh || fresh.status !== OrderStatus.PAID) {
        throw new BadRequestException('Order is no longer in a refundable state');
      }

      for (const item of fresh.items ?? []) {
        const tier = await manager.findOne(TicketType, {
          where: { id: item.ticketTypeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!tier) continue;
        tier.quantitySold = Math.max(0, tier.quantitySold - item.qty);
        await manager.save(tier);
      }

      for (const t of fresh.tickets ?? []) {
        if (t.status === TicketStatus.VOID) continue;
        t.status = TicketStatus.VOID;
        await manager.save(t);
      }

      fresh.status = OrderStatus.REFUNDED;
      await manager.save(fresh);

      for (const p of fresh.payments ?? []) {
        if (p.status === PaymentStatus.SUCCESS) {
          p.status = PaymentStatus.REFUNDED;
          p.rawPayload = {
            ...(p.rawPayload ?? {}),
            adminRefundAt: new Date().toISOString(),
            adminRefundReason: body.reason ?? null,
            ...(paystackRefundId !== undefined
              ? { paystackRefundId }
              : {}),
          };
          await manager.save(p);
        }
      }

      const ev = fresh.event as Event | undefined;
      const organizerId =
        ev?.organizer?.id ?? (ev as Event & { organizerId?: string })?.organizerId;
      if (organizerId) {
        await this.organizerLedgerService.ensureOrderRefundReversal(
          manager,
          fresh,
          organizerId,
        );
      }

      // Coupon rollback (COUPONS_SPEC §7). Compensates the redemption
      // so the per-code cap and the per-user cap reflect the buyer's
      // actual outcome. Best-effort — failures are logged so a refund
      // can never be blocked by ledger hiccups.
      if (fresh.appliedCouponId) {
        try {
          await this.couponsService.rollbackRedemption(manager, fresh.id);
        } catch (error) {
          this.logger.warn(
            `Coupon redemption rollback failed for refunded order ${fresh.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    });

    return {
      order: {
        id: order.id,
        status: OrderStatus.REFUNDED,
        previousStatus,
        refundAmountCents: refundAmount,
        originalAmountCents: order.amountCents,
        currency: order.currency,
        ...(paystackRefundSkipped ? { paystackRefundSkipped: true } : {}),
        ...(paystackRefundId !== undefined ? { paystackRefundId } : {}),
      },
    };
  }

  private async callPaystackRefund(
    secret: string,
    transaction: string | number,
  ): Promise<{ refundId?: number }> {
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction }),
    });
    const data = (await res.json().catch(() => ({}))) as PaystackRefundResponse;
    if (!res.ok || !data.status) {
      const msg =
        typeof data.message === 'string' ? data.message : 'Paystack refund failed';
      this.logger.warn(`Paystack refund HTTP ${res.status}: ${msg}`);
      throw new BadRequestException(msg);
    }
    const refundId = data.data?.id;
    return { refundId: typeof refundId === 'number' ? refundId : undefined };
  }
}
