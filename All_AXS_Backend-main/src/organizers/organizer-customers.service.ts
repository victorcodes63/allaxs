import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { OrderStatus } from '../domain/enums';
import { normalizeCurrencyCode } from '../common/currency';

function toInt(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseBuyerNameFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  try {
    const meta = JSON.parse(notes) as { buyerName?: string };
    return (meta.buyerName ?? '').trim();
  } catch {
    return '';
  }
}

function escapeLike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export type OrganizerCustomerRow = {
  id: string;
  email: string;
  name: string;
  ordersCount: number;
  ticketsCount: number;
  totalSpentCents: number;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  eventIds: string[];
};

export type OrganizerCustomerOrderRow = {
  id: string;
  reference: string | null;
  createdAt: string;
  status: string;
  eventId: string;
  eventTitle: string;
  amountCents: number;
  feesCents: number;
  netCents: number;
  currency: string;
  ticketsInOrder: number;
  lineSummary: string;
};

/**
 * CRM rollup of buyers across an organizer's events. Aggregation is
 * keyed by lower-cased email so capitalisation differences in the
 * `orders.email` (citext) column collapse to a single buyer row.
 */
@Injectable()
export class OrganizerCustomersService {
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

  private paidOrdersBaseQuery(profileId: string) {
    return this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .leftJoin('o.items', 'items')
      .where('org.id = :profileId', { profileId })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('o.email IS NOT NULL')
      .andWhere("TRIM(o.email) <> ''");
  }

  async listCustomers(
    userId: string,
    opts: { q?: string; limit: number; offset: number },
  ): Promise<{
    customers: OrganizerCustomerRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);

    const ordersQb = this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .leftJoinAndSelect('o.items', 'items')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('o.email IS NOT NULL')
      .andWhere("TRIM(o.email) <> ''");

    if (opts.q?.trim()) {
      const needle = `%${escapeLike(opts.q.trim())}%`;
      ordersQb.andWhere(
        new Brackets((w) => {
          w.where('o.email ILIKE :needle ESCAPE :esc', { needle, esc: '\\' });
          w.orWhere("COALESCE(o.notes, '') ILIKE :needle ESCAPE :esc", {
            needle,
            esc: '\\',
          });
        }),
      );
    }

    const orders = await ordersQb.orderBy('o.createdAt', 'DESC').getMany();

    type Agg = {
      email: string;
      emailKey: string;
      ordersCount: number;
      ticketsCount: number;
      totalSpentCents: number;
      currency: string;
      firstOrderAt: Date | null;
      lastOrderAt: Date | null;
      eventIds: Set<string>;
      name: string;
    };

    const byEmail = new Map<string, Agg>();

    for (const order of orders) {
      const email = order.email.trim();
      const emailKey = email.toLowerCase();
      if (!emailKey) continue;

      let agg = byEmail.get(emailKey);
      if (!agg) {
        agg = {
          email,
          emailKey,
          ordersCount: 0,
          ticketsCount: 0,
          totalSpentCents: 0,
          currency: normalizeCurrencyCode(order.currency),
          firstOrderAt: null,
          lastOrderAt: null,
          eventIds: new Set<string>(),
          name: parseBuyerNameFromNotes(order.notes),
        };
        byEmail.set(emailKey, agg);
      }

      agg.ordersCount += 1;
      agg.ticketsCount += (order.items ?? []).reduce(
        (sum, item) => sum + (item.qty ?? 0),
        0,
      );
      agg.totalSpentCents += order.amountCents ?? 0;
      agg.eventIds.add(order.eventId);

      const createdAt = order.createdAt;
      if (!agg.firstOrderAt || createdAt < agg.firstOrderAt) {
        agg.firstOrderAt = createdAt;
      }
      if (!agg.lastOrderAt || createdAt > agg.lastOrderAt) {
        agg.lastOrderAt = createdAt;
        const name = parseBuyerNameFromNotes(order.notes);
        if (name) agg.name = name;
      }
    }

    const sorted = [...byEmail.values()].sort((a, b) => {
      const aTime = a.lastOrderAt?.getTime() ?? 0;
      const bTime = b.lastOrderAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    const total = sorted.length;
    const page = sorted.slice(opts.offset, opts.offset + opts.limit);

    const customers: OrganizerCustomerRow[] = page.map((agg) => ({
      id: agg.emailKey,
      email: agg.email,
      name: agg.name,
      ordersCount: agg.ordersCount,
      ticketsCount: agg.ticketsCount,
      totalSpentCents: agg.totalSpentCents,
      currency: agg.currency,
      firstOrderAt: agg.firstOrderAt?.toISOString() ?? null,
      lastOrderAt: agg.lastOrderAt?.toISOString() ?? null,
      eventIds: [...agg.eventIds],
    }));

    return { customers, total, limit: opts.limit, offset: opts.offset };
  }

  async listOrdersForCustomerEmail(
    userId: string,
    email: string,
    opts: { limit: number; offset: number },
  ): Promise<{
    customer: {
      id: string;
      email: string;
      name: string;
      ordersCount: number;
      ticketsCount: number;
      totalSpentCents: number;
      currency: string;
      firstOrderAt: string | null;
      lastOrderAt: string | null;
    };
    orders: OrganizerCustomerOrderRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      throw new ForbiddenException('Customer email is required');
    }

    const emailKey = trimmedEmail.toLowerCase();

    const base = this.orderRepository
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('LOWER(o.email) = :emailKey', { emailKey });

    const total = await base.clone().getCount();

    const rows = await base
      .clone()
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.ticketType', 'ticketType')
      .orderBy('o.createdAt', 'DESC')
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

    const rollup = await this.paidOrdersBaseQuery(profile.id)
      .select('COUNT(DISTINCT o.id)', 'ordersCount')
      .addSelect('COALESCE(SUM(items.qty), 0)', 'ticketsCount')
      .addSelect('SUM(o.amountCents)', 'totalSpentCents')
      .addSelect('MIN(o.createdAt)', 'firstOrderAt')
      .addSelect('MAX(o.createdAt)', 'lastOrderAt')
      .addSelect('MAX(o.currency)', 'currency')
      .andWhere('LOWER(o.email) = :emailKey', { emailKey })
      .getRawOne<{
        ordersCount: string;
        ticketsCount: string;
        totalSpentCents: string;
        firstOrderAt: string | null;
        lastOrderAt: string | null;
        currency: string;
      }>();

    const orders: OrganizerCustomerOrderRow[] = rows.map((o) => {
      const items = o.items ?? [];
      const ticketsInOrder = items.reduce((s, i) => s + (i.qty ?? 0), 0);
      const parts = items.map(
        (i) => `${i.ticketType?.name ?? 'Ticket'} × ${i.qty}`,
      );
      const lineSummary =
        parts.length === 0
          ? '—'
          : parts.length <= 2
            ? parts.join(', ')
            : `${parts[0]} + ${parts.length - 1} more`;
      const fees = o.feesCents ?? 0;
      const gross = o.amountCents;
      return {
        id: o.id,
        reference: o.reference ?? null,
        createdAt: o.createdAt.toISOString(),
        status: o.status,
        eventId: o.eventId,
        eventTitle: o.event?.title ?? 'Event',
        amountCents: gross,
        feesCents: fees,
        netCents: Math.max(0, gross - fees),
        currency: normalizeCurrencyCode(o.currency),
        ticketsInOrder,
        lineSummary,
      };
    });

    const name =
      rows.length > 0 ? parseBuyerNameFromNotes(rows[0].notes) : '';

    return {
      customer: {
        id: emailKey,
        email: trimmedEmail,
        name,
        ordersCount: toInt(rollup?.ordersCount),
        ticketsCount: toInt(rollup?.ticketsCount),
        totalSpentCents: toInt(rollup?.totalSpentCents),
        currency: normalizeCurrencyCode(rollup?.currency || undefined),
        firstOrderAt: rollup?.firstOrderAt
          ? new Date(rollup.firstOrderAt).toISOString()
          : null,
        lastOrderAt: rollup?.lastOrderAt
          ? new Date(rollup.lastOrderAt).toISOString()
          : null,
      },
      orders,
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }
}
