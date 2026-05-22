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
import { OrderStatus } from '../domain/enums';

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

@Injectable()
export class OrganizerAnalyticsService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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
}
