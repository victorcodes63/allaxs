import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { OrderStatus } from '../domain/enums';

function parseBuyerNameFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  try {
    const meta = JSON.parse(notes) as { buyerName?: string };
    return (meta.buyerName ?? '').trim();
  } catch {
    return '';
  }
}

function toInt(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

export type OrganizerSalesEventRow = {
  eventId: string;
  title: string;
  slug: string;
  status: string;
  startAt: string;
  currency: string;
  capacityTotal: number;
  ticketsSold: number;
  ordersCount: number;
  grossCents: number;
  feesCents: number;
};

export type OrganizerSalesOrderRow = {
  id: string;
  createdAt: string;
  status: string;
  eventId: string;
  eventTitle: string;
  buyerEmail: string;
  buyerName: string;
  amountCents: number;
  feesCents: number;
  currency: string;
  ticketsInOrder: number;
  lineSummary: string;
};

@Injectable()
export class OrganizerSalesService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  private async getOrganizerProfileOrThrow(
    userId: string,
  ): Promise<OrganizerProfile> {
    const profile = await this.organizerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Organizer profile not found. Please complete organizer onboarding first.',
      );
    }
    return profile;
  }

  async getSalesSummary(userId: string): Promise<{
    events: OrganizerSalesEventRow[];
    rollup: {
      grossCents: number;
      feesCents: number;
      ticketsSold: number;
      ordersCount: number;
      currency: string;
    };
  }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);

    const events = await this.eventRepository.find({
      where: { organizer: { id: profile.id } },
      relations: ['ticketTypes'],
      order: { startAt: 'DESC' },
    });

    if (events.length === 0) {
      return {
        events: [],
        rollup: {
          grossCents: 0,
          feesCents: 0,
          ticketsSold: 0,
          ordersCount: 0,
          currency: 'KES',
        },
      };
    }

    const eventIds = events.map((e) => e.id);

    const orderAgg = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.eventId', 'eventId')
      .addSelect('COUNT(o.id)', 'ordersCount')
      .addSelect('SUM(o.amountCents)', 'grossCents')
      .addSelect('SUM(o.feesCents)', 'feesCents')
      .where('o.status = :st', { st: OrderStatus.PAID })
      .andWhere('o.eventId IN (:...eventIds)', { eventIds })
      .groupBy('o.eventId')
      .getRawMany();

    const itemAgg = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .select('o.eventId', 'eventId')
      .addSelect('SUM(oi.qty)', 'ticketsSold')
      .where('o.status = :st', { st: OrderStatus.PAID })
      .andWhere('o.eventId IN (:...eventIds)', { eventIds })
      .groupBy('o.eventId')
      .getRawMany();

    const orderByEvent = new Map<
      string,
      { ordersCount: number; grossCents: number; feesCents: number }
    >();
    for (const row of orderAgg) {
      orderByEvent.set(row.eventId, {
        ordersCount: toInt(row.ordersCount),
        grossCents: toInt(row.grossCents),
        feesCents: toInt(row.feesCents),
      });
    }

    const ticketsByEvent = new Map<string, number>();
    for (const row of itemAgg) {
      ticketsByEvent.set(row.eventId, toInt(row.ticketsSold));
    }

    const rows: OrganizerSalesEventRow[] = events.map((e) => {
      const caps = (e.ticketTypes ?? []).reduce(
        (sum, t) => sum + (t.quantityTotal ?? 0),
        0,
      );
      const currency =
        (e.ticketTypes ?? []).find((t) => t.currency)?.currency ?? 'KES';
      const o = orderByEvent.get(e.id);
      return {
        eventId: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        startAt: e.startAt.toISOString(),
        currency,
        capacityTotal: caps,
        ticketsSold: ticketsByEvent.get(e.id) ?? 0,
        ordersCount: o?.ordersCount ?? 0,
        grossCents: o?.grossCents ?? 0,
        feesCents: o?.feesCents ?? 0,
      };
    });

    const rollup = rows.reduce(
      (acc, r) => ({
        grossCents: acc.grossCents + r.grossCents,
        feesCents: acc.feesCents + r.feesCents,
        ticketsSold: acc.ticketsSold + r.ticketsSold,
        ordersCount: acc.ordersCount + r.ordersCount,
        currency: acc.currency || r.currency,
      }),
      {
        grossCents: 0,
        feesCents: 0,
        ticketsSold: 0,
        ordersCount: 0,
        currency: '',
      },
    );

    if (!rollup.currency) {
      rollup.currency = 'KES';
    }

    return { events: rows, rollup };
  }

  async listOrders(
    userId: string,
    opts: { eventId?: string; limit: number; offset: number },
  ): Promise<{
    orders: OrganizerSalesOrderRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);

    if (opts.eventId) {
      const owned = await this.eventRepository.findOne({
        where: { id: opts.eventId, organizer: { id: profile.id } },
      });
      if (!owned) {
        throw new ForbiddenException(
          'Event not found or you do not have access to it.',
        );
      }
    }

    const base = this.orderRepository
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .where('org.id = :profileId', { profileId: profile.id });

    if (opts.eventId) {
      base.andWhere('o.eventId = :eventId', { eventId: opts.eventId });
    }

    const total = await base.clone().getCount();

    const rows = await base
      .clone()
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.ticketType', 'ticketType')
      .orderBy('o.createdAt', 'DESC')
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

    const orders: OrganizerSalesOrderRow[] = rows.map((o) => {
      const items = o.items ?? [];
      const ticketsInOrder = items.reduce((s, i) => s + (i.qty ?? 0), 0);
      const parts = items.map(
        (i) =>
          `${i.ticketType?.name ?? 'Ticket'} × ${i.qty}`,
      );
      const lineSummary =
        parts.length === 0
          ? '—'
          : parts.length <= 2
            ? parts.join(', ')
            : `${parts[0]} + ${parts.length - 1} more`;

      return {
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        status: o.status,
        eventId: o.eventId,
        eventTitle: o.event?.title ?? 'Event',
        buyerEmail: o.email,
        buyerName: parseBuyerNameFromNotes(o.notes),
        amountCents: o.amountCents,
        feesCents: o.feesCents ?? 0,
        currency: o.currency,
        ticketsInOrder,
        lineSummary,
      };
    });

    return {
      orders,
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }
}
