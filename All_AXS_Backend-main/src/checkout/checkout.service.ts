import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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
  }> {
    this.assertDemoCheckoutEnabled();

    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id: dto.eventId, status: EventStatus.PUBLISHED },
        relations: ['ticketTypes'],
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
      const order = manager.create(Order, {
        userId,
        eventId: event.id,
        status: OrderStatus.PAID,
        amountCents: totalCents,
        feesCents: 0,
        currency: normalizedLines[0]?.currency ?? 'KES',
        reference,
        email: dto.buyerEmail,
        phone: dto.buyerPhone,
        notes: JSON.stringify({ demo: true, buyerName: dto.buyerName }),
      });
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
        amountCents: totalCents,
        currency: order.currency,
        rawPayload: { demo: true },
      });
      await manager.save(payment);

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
      };
    });
  }

  async getOrderSummaryForUser(
    userId: string,
    orderId: string,
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
  }> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: ['event', 'items', 'items.ticketType'],
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

    return {
      order: {
        id: order.id,
        eventId: order.eventId,
        totalCents: order.amountCents,
        currency: order.currency,
        eventTitle: order.event.title,
        eventSlug: order.event.slug,
        buyerName,
        buyerEmail: order.email,
        lineItems,
      },
    };
  }
}
