import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AffiliateCode } from './entities/affiliate-code.entity';
import { AffiliateConversion } from './entities/affiliate-conversion.entity';
import { Order } from '../domain/order.entity';
import { OrderStatus } from '../domain/enums';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';
import { OrganizerScopeService } from './organizer-scope.service';

export type AffiliateRow = {
  id: string;
  code: string;
  name: string;
  eventId: string | null;
  eventTitle: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED';
  commissionPercent: number;
  ordersCount: number;
  conversionsCount: number;
  visits: number;
  revenueCents: number;
  currency: string;
};

@Injectable()
export class OrganizerAffiliatesService {
  constructor(
    @InjectRepository(AffiliateCode)
    private readonly affiliateRepository: Repository<AffiliateCode>,
    @InjectRepository(AffiliateConversion)
    private readonly conversionRepository: Repository<AffiliateConversion>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly scopeService: OrganizerScopeService,
  ) {}

  private serializeStatus(isActive: boolean): AffiliateRow['status'] {
    return isActive ? 'ACTIVE' : 'PAUSED';
  }

  private async statsForCodes(
    codes: AffiliateCode[],
  ): Promise<Map<string, { ordersCount: number; revenueCents: number; currency: string }>> {
    const out = new Map<
      string,
      { ordersCount: number; revenueCents: number; currency: string }
    >();
    if (codes.length === 0) return out;

    const codeIds = codes.map((c) => c.id);
    const conversions = await this.conversionRepository.find({
      where: { affiliateCodeId: In(codeIds) },
      relations: ['order'],
    });

    for (const code of codes) {
      const codeConversions = conversions.filter(
        (c) => c.affiliateCodeId === code.id,
      );
      const revenueCents = codeConversions.reduce(
        (sum, c) => sum + (c.order?.amountCents ?? 0),
        0,
      );
      const currency =
        codeConversions.find((c) => c.order?.currency)?.order?.currency ??
        'KES';
      out.set(code.id, {
        ordersCount: codeConversions.length,
        revenueCents,
        currency,
      });
    }

    // Fallback: count paid orders tagged with affiliate_code string on owned events.
    for (const code of codes) {
      if ((out.get(code.id)?.ordersCount ?? 0) > 0) continue;
      const qb = this.orderRepository
        .createQueryBuilder('o')
        .where('o.affiliate_code = :code', { code: code.code })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [OrderStatus.PAID, OrderStatus.REFUNDED],
        });
      if (code.eventId) {
        qb.andWhere('o.event_id = :eventId', { eventId: code.eventId });
      } else {
        qb.andWhere('o.event_id IN (SELECT id FROM events WHERE organizer_id = :orgId)', {
          orgId: code.organizerProfileId,
        });
      }
      const orders = await qb.getMany();
      if (orders.length === 0) continue;
      out.set(code.id, {
        ordersCount: orders.length,
        revenueCents: orders.reduce((s, o) => s + o.amountCents, 0),
        currency: orders[0]?.currency ?? 'KES',
      });
    }

    return out;
  }

  private async serializeRow(code: AffiliateCode): Promise<AffiliateRow> {
    const statsMap = await this.statsForCodes([code]);
    const stats = statsMap.get(code.id) ?? {
      ordersCount: 0,
      revenueCents: 0,
      currency: 'KES',
    };
    const count = stats.ordersCount;
    return {
      id: code.id,
      code: code.code,
      name: code.notes?.trim() ?? '',
      eventId: code.eventId ?? null,
      eventTitle: code.event?.title ?? null,
      status: this.serializeStatus(code.isActive),
      commissionPercent: Number(code.commissionPercent ?? 0),
      ordersCount: count,
      conversionsCount: count,
      visits: 0,
      revenueCents: stats.revenueCents,
      currency: stats.currency,
    };
  }

  async listForUser(userId: string): Promise<AffiliateRow[]> {
    const profile = await this.scopeService.getProfileOrThrow(userId);
    const codes = await this.affiliateRepository.find({
      where: { organizerProfileId: profile.id },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
    const statsMap = await this.statsForCodes(codes);
    return codes.map((code) => {
      const stats = statsMap.get(code.id) ?? {
        ordersCount: 0,
        revenueCents: 0,
        currency: 'KES',
      };
      const count = stats.ordersCount;
      return {
        id: code.id,
        code: code.code,
        name: code.notes?.trim() ?? '',
        eventId: code.eventId ?? null,
        eventTitle: code.event?.title ?? null,
        status: this.serializeStatus(code.isActive),
        commissionPercent: Number(code.commissionPercent ?? 0),
        ordersCount: count,
        conversionsCount: count,
        visits: 0,
        revenueCents: stats.revenueCents,
        currency: stats.currency,
      };
    });
  }

  async createForUser(userId: string, dto: CreateAffiliateDto): Promise<AffiliateRow> {
    const profile = await this.scopeService.getProfileOrThrow(userId);
    await this.scopeService.assertEventInScope(userId, dto.eventId);

    const code = dto.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Code is required');
    }

    const existing = await this.affiliateRepository.findOne({
      where: { organizerProfileId: profile.id, code },
    });
    if (existing) {
      throw new ConflictException('An affiliate code with this value already exists');
    }

    const percent = dto.commissionPercent ?? 0;
    if (percent < 0 || percent > 100) {
      throw new BadRequestException('Commission percent must be between 0 and 100');
    }

    const row = this.affiliateRepository.create({
      organizerProfileId: profile.id,
      eventId: dto.eventId ?? null,
      code,
      commissionPercent: percent,
      isActive: true,
      notes: dto.name?.trim() || null,
    });
    const saved = await this.affiliateRepository.save(row);
    const hydrated = await this.affiliateRepository.findOne({
      where: { id: saved.id },
      relations: ['event'],
    });
    return this.serializeRow(hydrated ?? saved);
  }

  async updateForUser(
    userId: string,
    id: string,
    dto: UpdateAffiliateDto,
  ): Promise<AffiliateRow> {
    const profile = await this.scopeService.getProfileOrThrow(userId);
    const row = await this.affiliateRepository.findOne({
      where: { id, organizerProfileId: profile.id },
      relations: ['event'],
    });
    if (!row) {
      throw new NotFoundException('Affiliate code not found');
    }
    if (dto.status) {
      row.isActive = dto.status === 'ACTIVE';
    }
    const saved = await this.affiliateRepository.save(row);
    return this.serializeRow(saved);
  }

  async deleteForUser(userId: string, id: string): Promise<{ ok: true }> {
    const profile = await this.scopeService.getProfileOrThrow(userId);
    const result = await this.affiliateRepository.delete({
      id,
      organizerProfileId: profile.id,
    });
    if (!result.affected) {
      throw new NotFoundException('Affiliate code not found');
    }
    return { ok: true };
  }
}
