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
  email: string;
  name: string;
  totalOrders: number;
  totalSpentCents: number;
  currency: string;
  lastOrderAt: string;
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

    const baseQb = this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('o.email IS NOT NULL')
      .andWhere("TRIM(o.email) <> ''");

    if (opts.q?.trim()) {
      const needle = `%${escapeLike(opts.q.trim())}%`;
      baseQb.andWhere(
        new Brackets((w) => {
          w.where('o.email ILIKE :needle ESCAPE :esc', { needle, esc: '\\' });
          w.orWhere("COALESCE(o.notes, '') ILIKE :needle ESCAPE :esc", {
            needle,
            esc: '\\',
          });
        }),
      );
    }

    const groupedQb = baseQb
      .clone()
      .select('LOWER(o.email)', 'emailKey')
      .addSelect('MAX(o.email)', 'email')
      .addSelect('COUNT(o.id)', 'totalOrders')
      .addSelect('SUM(o.amountCents)', 'totalSpentCents')
      .addSelect('MAX(o.createdAt)', 'lastOrderAt')
      .addSelect('MAX(o.currency)', 'currency')
      .groupBy('LOWER(o.email)');

    const totalRows = await this.orderRepository.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from(`(${groupedQb.getQuery()})`, 'sub')
      .setParameters(groupedQb.getParameters())
      .getRawOne<{ count: string }>();
    const total = toInt(totalRows?.count);

    const rows = await groupedQb
      .orderBy('MAX(o.createdAt)', 'DESC')
      .offset(opts.offset)
      .limit(opts.limit)
      .getRawMany<{
        emailKey: string;
        email: string;
        totalOrders: string;
        totalSpentCents: string;
        lastOrderAt: string;
        currency: string;
      }>();

    if (rows.length === 0) {
      return { customers: [], total, limit: opts.limit, offset: opts.offset };
    }

    const emailKeys = rows.map((r) => r.emailKey);

    // Pull per-buyer event ids + a fallback buyer name from the most
    // recent order notes (we don't have a normalised customer entity
    // yet so notes is the canonical place buyer name lives).
    const eventRows = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .select('LOWER(o.email)', 'emailKey')
      .addSelect('o.eventId', 'eventId')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('LOWER(o.email) IN (:...emailKeys)', { emailKeys })
      .groupBy('LOWER(o.email)')
      .addGroupBy('o.eventId')
      .getRawMany<{ emailKey: string; eventId: string }>();

    const eventIdsByEmail = new Map<string, string[]>();
    for (const r of eventRows) {
      const list = eventIdsByEmail.get(r.emailKey) ?? [];
      if (!list.includes(r.eventId)) list.push(r.eventId);
      eventIdsByEmail.set(r.emailKey, list);
    }

    const nameRows = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .select('DISTINCT ON (LOWER(o.email)) LOWER(o.email)', 'emailKey')
      .addSelect('o.notes', 'notes')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('LOWER(o.email) IN (:...emailKeys)', { emailKeys })
      .orderBy('LOWER(o.email)', 'ASC')
      .addOrderBy('o.createdAt', 'DESC')
      .getRawMany<{ emailKey: string; notes: string | null }>();

    const nameByEmail = new Map<string, string>();
    for (const r of nameRows) {
      nameByEmail.set(r.emailKey, parseBuyerNameFromNotes(r.notes));
    }

    const customers: OrganizerCustomerRow[] = rows.map((r) => ({
      email: r.email,
      name: nameByEmail.get(r.emailKey) ?? '',
      totalOrders: toInt(r.totalOrders),
      totalSpentCents: toInt(r.totalSpentCents),
      currency: normalizeCurrencyCode(r.currency || undefined),
      lastOrderAt: r.lastOrderAt
        ? new Date(r.lastOrderAt).toISOString()
        : new Date(0).toISOString(),
      eventIds: eventIdsByEmail.get(r.emailKey) ?? [],
    }));

    return { customers, total, limit: opts.limit, offset: opts.offset };
  }

  async listOrdersForCustomerEmail(
    userId: string,
    email: string,
    opts: { limit: number; offset: number },
  ): Promise<{
    customer: { email: string; name: string };
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

    const base = this.orderRepository
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('LOWER(o.email) = LOWER(:email)', { email: trimmedEmail });

    const total = await base.clone().getCount();

    const rows = await base
      .clone()
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.ticketType', 'ticketType')
      .orderBy('o.createdAt', 'DESC')
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

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

    const name = rows.length > 0 ? parseBuyerNameFromNotes(rows[0].notes) : '';

    return {
      customer: { email: trimmedEmail, name },
      orders,
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }
}
