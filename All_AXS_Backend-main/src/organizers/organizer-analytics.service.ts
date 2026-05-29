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
import { Ticket } from '../domain/ticket.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { OrderStatus, TicketStatus } from '../domain/enums';
import { OrganizerScopeService } from './organizer-scope.service';

const TREND_DAYS = 14;

function toInt(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

export type OrganizerDailySalesPoint = {
  date: string;
  count: number;
  grossCents: number;
};

export type OrganizerAnalyticsSummary = {
  generatedAt: string;
  eventId: string | null;
  currency: string;
  paid: {
    count: number;
    grossCents: number;
  };
  refunded: {
    count: number;
    grossCents: number;
    rate: number;
  };
  conversionRate: number;
  dailySales: OrganizerDailySalesPoint[];
};

export type OrganizerEventInsights = {
  rangeStart: string | null;
  rangeEnd: string | null;
  scanned: number;
  totalIssued: number;
  scanRate: number;
  totalRevenueCents: number;
  totalNetCents: number;
  currency: string;
  tiers: Array<{
    tierId: string;
    name: string;
    ticketsSold: number;
    capacity: number;
    grossCents: number;
    netCents: number;
    currency: string;
  }>;
  trafficSources: Array<{
    source: string;
    visits: number;
    conversions: number;
    revenueCents: number;
  }>;
  timeline: Array<{
    date: string;
    ticketsSold: number;
    grossCents: number;
  }>;
};

@Injectable()
export class OrganizerAnalyticsService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    private readonly scopeService: OrganizerScopeService,
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

  private buildDailyTrend(
    trendStart: Date,
    rows: ReadonlyArray<{
      date: string;
      count: string | number;
      grossCents: string | number;
    }>,
  ): OrganizerDailySalesPoint[] {
    const byDate = new Map<string, { count: number; grossCents: number }>();
    for (const row of rows) {
      byDate.set(row.date, {
        count: toInt(row.count),
        grossCents: toInt(row.grossCents),
      });
    }
    return Array.from({ length: TREND_DAYS }, (_, index) => {
      const date = new Date(trendStart);
      date.setUTCDate(trendStart.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const slot = byDate.get(key) ?? { count: 0, grossCents: 0 };
      return { date: key, count: slot.count, grossCents: slot.grossCents };
    });
  }

  async getAnalyticsSummary(
    userId: string,
    eventId?: string,
  ): Promise<OrganizerAnalyticsSummary> {
    const profile = await this.getOrganizerProfileOrThrow(userId);
    const trimmedEventId = eventId?.trim() || undefined;

    if (trimmedEventId) {
      const owned = await this.eventRepository.findOne({
        where: { id: trimmedEventId, organizer: { id: profile.id } },
        relations: ['ticketTypes'],
      });
      if (!owned) {
        throw new ForbiddenException(
          'Event not found or you do not have access to it.',
        );
      }
    }

    const events = await this.eventRepository.find({
      where: trimmedEventId
        ? { id: trimmedEventId, organizer: { id: profile.id } }
        : { organizer: { id: profile.id } },
      relations: ['ticketTypes'],
    });

    const eventIds = events.map((e) => e.id);
    const currency =
      events
        .flatMap((e) => e.ticketTypes ?? [])
        .find((t) => t.currency)?.currency ?? 'KES';

    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));

    if (eventIds.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        eventId: trimmedEventId ?? null,
        currency,
        paid: { count: 0, grossCents: 0 },
        refunded: { count: 0, grossCents: 0, rate: 0 },
        conversionRate: 0,
        dailySales: this.buildDailyTrend(trendStart, []),
      };
    }

    const scope = this.orderRepository
      .createQueryBuilder('o')
      .where('o.eventId IN (:...eventIds)', { eventIds });

    const [paidRow, refundedRow, funnelRow, dailyRows] = await Promise.all([
      scope
        .clone()
        .select('COUNT(o.id)', 'count')
        .addSelect('COALESCE(SUM(o.amountCents), 0)', 'grossCents')
        .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
        .getRawOne<{ count: string; grossCents: string }>(),
      scope
        .clone()
        .select('COUNT(o.id)', 'count')
        .addSelect('COALESCE(SUM(o.amountCents), 0)', 'grossCents')
        .andWhere('o.status = :refunded', { refunded: OrderStatus.REFUNDED })
        .getRawOne<{ count: string; grossCents: string }>(),
      scope
        .clone()
        .select('o.status', 'status')
        .addSelect('COUNT(o.id)', 'count')
        .andWhere('o.status <> :draft', { draft: OrderStatus.DRAFT })
        .groupBy('o.status')
        .getRawMany<{ status: OrderStatus; count: string }>(),
      scope
        .clone()
        .select(
          `TO_CHAR(DATE_TRUNC('day', o."createdAt"), 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('COUNT(o.id)', 'count')
        .addSelect('COALESCE(SUM(o.amountCents), 0)', 'grossCents')
        .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
        .andWhere('o."createdAt" >= :trendStart', { trendStart })
        .groupBy(`DATE_TRUNC('day', o."createdAt")`)
        .orderBy(`DATE_TRUNC('day', o."createdAt")`, 'ASC')
        .getRawMany<{ date: string; count: string; grossCents: string }>(),
    ]);

    const paidCount = toInt(paidRow?.count);
    const paidGrossCents = toInt(paidRow?.grossCents);
    const refundedCount = toInt(refundedRow?.count);
    const refundedGrossCents = toInt(refundedRow?.grossCents);

    const settledCount = paidCount + refundedCount;
    const refundRate =
      settledCount > 0 ? refundedCount / settledCount : 0;

    let checkoutAttempts = 0;
    for (const row of funnelRow) {
      checkoutAttempts += toInt(row.count);
    }
    const conversionRate =
      checkoutAttempts > 0 ? paidCount / checkoutAttempts : 0;

    return {
      generatedAt: new Date().toISOString(),
      eventId: trimmedEventId ?? null,
      currency,
      paid: {
        count: paidCount,
        grossCents: paidGrossCents,
      },
      refunded: {
        count: refundedCount,
        grossCents: refundedGrossCents,
        rate: refundRate,
      },
      conversionRate,
      dailySales: this.buildDailyTrend(trendStart, dailyRows),
    };
  }

  private parseInsightRange(
    fromRaw?: string,
    toRaw?: string,
  ): { from: Date; to: Date } {
    const now = new Date();
    const to = toRaw ? new Date(toRaw) : now;
    const from = fromRaw
      ? new Date(fromRaw)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ForbiddenException('Invalid date range');
    }
    if (from.getTime() > to.getTime()) {
      throw new ForbiddenException('`from` must be before `to`');
    }
    return { from, to };
  }

  private trafficSourceLabel(order: Order): string {
    const utm = order.utmSource?.trim();
    if (utm) return utm.toLowerCase();
    const affiliate = order.affiliateCode?.trim();
    if (affiliate) return `affiliate:${affiliate.toLowerCase()}`;
    const ref = order.referrer?.trim();
    if (ref) {
      try {
        const host = new URL(ref).hostname.replace(/^www\./, '');
        if (host) return host;
      } catch {
        return ref.slice(0, 80);
      }
    }
    return 'direct';
  }

  async getEventInsights(
    userId: string,
    eventId: string,
    fromRaw?: string,
    toRaw?: string,
  ): Promise<OrganizerEventInsights> {
    const trimmedEventId = eventId?.trim();
    if (!trimmedEventId) {
      throw new NotFoundException('eventId is required');
    }

    await this.scopeService.assertEventOwned(userId, trimmedEventId);
    const { from, to } = this.parseInsightRange(fromRaw, toRaw);

    const ticketTypes = await this.ticketTypeRepository.find({
      where: { eventId: trimmedEventId },
      order: { createdAt: 'ASC' },
    });
    const currency =
      ticketTypes.find((t) => t.currency)?.currency ?? 'KES';

    const paidOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.event_id = :eventId', { eventId: trimmedEventId })
      .andWhere('o.status = :status', { status: OrderStatus.PAID })
      .andWhere('o."createdAt" >= :from', { from })
      .andWhere('o."createdAt" <= :to', { to })
      .getMany();

    const orderIds = paidOrders.map((o) => o.id);
    const totalRevenueCents = paidOrders.reduce(
      (sum, o) => sum + toInt(o.amountCents),
      0,
    );
    const totalNetCents = paidOrders.reduce(
      (sum, o) => sum + toInt(o.amountCents) - toInt(o.feesCents),
      0,
    );

    let totalIssued = 0;
    let scanned = 0;
    if (orderIds.length > 0) {
      const ticketRows = await this.ticketRepository
        .createQueryBuilder('t')
        .select('t.status', 'status')
        .addSelect('COUNT(t.id)', 'count')
        .where('t.order_id IN (:...orderIds)', { orderIds })
        .andWhere('t.status <> :void', { void: TicketStatus.VOID })
        .groupBy('t.status')
        .getRawMany<{ status: TicketStatus; count: string }>();

      for (const row of ticketRows) {
        const count = toInt(row.count);
        totalIssued += count;
        if (row.status === TicketStatus.CHECKED_IN) {
          scanned += count;
        }
      }
    }

    const tierStats = new Map<
      string,
      { ticketsSold: number; grossCents: number; netCents: number }
    >();
    for (const tier of ticketTypes) {
      tierStats.set(tier.id, {
        ticketsSold: 0,
        grossCents: 0,
        netCents: 0,
      });
    }

    if (orderIds.length > 0) {
      const itemRows = await this.orderItemRepository
        .createQueryBuilder('i')
        .innerJoin('i.order', 'o')
        .select('i.ticket_type_id', 'tierId')
        .addSelect('SUM(i.qty)', 'qty')
        .addSelect('SUM(i.qty * i.unit_price_cents)', 'grossCents')
        .where('i.order_id IN (:...orderIds)', { orderIds })
        .groupBy('i.ticket_type_id')
        .getRawMany<{ tierId: string; qty: string; grossCents: string }>();

      for (const row of itemRows) {
        const slot = tierStats.get(row.tierId) ?? {
          ticketsSold: 0,
          grossCents: 0,
          netCents: 0,
        };
        const gross = toInt(row.grossCents);
        slot.ticketsSold += toInt(row.qty);
        slot.grossCents += gross;
        slot.netCents += gross;
        tierStats.set(row.tierId, slot);
      }
    }

    const feeRatio =
      totalRevenueCents > 0
        ? (totalRevenueCents - totalNetCents) / totalRevenueCents
        : 0;

    const tiers = ticketTypes.map((tier) => {
      const stats = tierStats.get(tier.id) ?? {
        ticketsSold: 0,
        grossCents: 0,
        netCents: 0,
      };
      const netCents = Math.round(stats.grossCents * (1 - feeRatio));
      return {
        tierId: tier.id,
        name: tier.name,
        ticketsSold: stats.ticketsSold,
        capacity: tier.quantityTotal,
        grossCents: stats.grossCents,
        netCents,
        currency: tier.currency || currency,
      };
    });

    const trafficMap = new Map<
      string,
      { conversions: number; revenueCents: number }
    >();
    for (const order of paidOrders) {
      const source = this.trafficSourceLabel(order);
      const slot = trafficMap.get(source) ?? {
        conversions: 0,
        revenueCents: 0,
      };
      slot.conversions += 1;
      slot.revenueCents += toInt(order.amountCents);
      trafficMap.set(source, slot);
    }
    const trafficSources = [...trafficMap.entries()]
      .map(([source, stats]) => ({
        source,
        visits: 0,
        conversions: stats.conversions,
        revenueCents: stats.revenueCents,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    const dailyRows =
      orderIds.length === 0
        ? []
        : await this.orderRepository
            .createQueryBuilder('o')
            .select(
              `TO_CHAR(DATE_TRUNC('day', o."createdAt"), 'YYYY-MM-DD')`,
              'date',
            )
            .addSelect('COUNT(o.id)', 'orders')
            .addSelect('COALESCE(SUM(o.amountCents), 0)', 'grossCents')
            .where('o.id IN (:...orderIds)', { orderIds })
            .groupBy(`DATE_TRUNC('day', o."createdAt")`)
            .orderBy(`DATE_TRUNC('day', o."createdAt")`, 'ASC')
            .getRawMany<{ date: string; orders: string; grossCents: string }>();

    let ticketsByDay: Array<{ date: string; ticketsSold: string }> = [];
    if (orderIds.length > 0) {
      ticketsByDay = await this.ticketRepository
        .createQueryBuilder('t')
        .innerJoin('t.order', 'o')
        .select(
          `TO_CHAR(DATE_TRUNC('day', o."createdAt"), 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('COUNT(t.id)', 'ticketsSold')
        .where('t.order_id IN (:...orderIds)', { orderIds })
        .andWhere('t.status <> :void', { void: TicketStatus.VOID })
        .groupBy(`DATE_TRUNC('day', o."createdAt")`)
        .getRawMany<{ date: string; ticketsSold: string }>();
    }

    const ticketsByDate = new Map(
      ticketsByDay.map((row) => [row.date, toInt(row.ticketsSold)]),
    );
    const timeline = dailyRows.map((row) => ({
      date: row.date,
      ticketsSold: ticketsByDate.get(row.date) ?? toInt(row.orders),
      grossCents: toInt(row.grossCents),
    }));

    const scanRate = totalIssued > 0 ? scanned / totalIssued : 0;

    return {
      rangeStart: from.toISOString(),
      rangeEnd: to.toISOString(),
      scanned,
      totalIssued,
      scanRate,
      totalRevenueCents,
      totalNetCents,
      currency,
      tiers,
      trafficSources,
      timeline,
    };
  }
}
