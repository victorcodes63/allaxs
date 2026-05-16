import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OrganizerLedgerEntry } from './organizer-ledger-entry.entity';
import { Order } from './order.entity';
import { LedgerEntryType, PayoutBatchStatus } from './enums';
import { PayoutBatchLine } from './payout-batch-line.entity';

const RESERVED_BATCH_STATUSES: PayoutBatchStatus[] = [
  PayoutBatchStatus.DRAFT,
  PayoutBatchStatus.APPROVED,
  PayoutBatchStatus.EXPORTED,
];

@Injectable()
export class OrganizerLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  organizerNetCents(order: Order): number {
    const fees = order.feesCents ?? 0;
    return Math.max(0, order.amountCents - fees);
  }

  async ensureOrderEarnings(
    manager: EntityManager,
    order: Order,
    organizerId: string,
  ): Promise<void> {
    const net = this.organizerNetCents(order);
    if (net <= 0) {
      return;
    }
    const idempotencyKey = `earn:order:${order.id}`;
    await manager
      .createQueryBuilder()
      .insert()
      .into(OrganizerLedgerEntry)
      .values({
        organizerId,
        orderId: order.id,
        entryType: LedgerEntryType.ORDER_EARNINGS,
        amountCents: net,
        currency: order.currency,
        idempotencyKey,
        metadata: {
          orderId: order.id,
          grossCents: order.amountCents,
          feesCents: order.feesCents ?? 0,
        },
      })
      .orIgnore()
      .execute();
  }

  async ensureOrderRefundReversal(
    manager: EntityManager,
    order: Order,
    organizerId: string,
  ): Promise<void> {
    const earnKey = `earn:order:${order.id}`;
    const earn = await manager.findOne(OrganizerLedgerEntry, {
      where: { idempotencyKey: earnKey },
    });
    if (!earn || earn.amountCents <= 0) {
      return;
    }
    const idempotencyKey = `refund:order:${order.id}`;
    await manager
      .createQueryBuilder()
      .insert()
      .into(OrganizerLedgerEntry)
      .values({
        organizerId,
        orderId: order.id,
        entryType: LedgerEntryType.ORDER_REFUND_REVERSAL,
        amountCents: -earn.amountCents,
        currency: order.currency,
        idempotencyKey,
        metadata: { orderId: order.id, reversedEarnEntryId: earn.id },
      })
      .orIgnore()
      .execute();
  }

  async appendPayoutDebit(
    manager: EntityManager,
    params: {
      organizerId: string;
      amountCents: number;
      currency: string;
      batchLineId: string;
      batchId: string;
    },
  ): Promise<void> {
    const { organizerId, amountCents, currency, batchLineId, batchId } = params;
    if (amountCents <= 0) {
      return;
    }
    const idempotencyKey = `payout:line:${batchLineId}`;
    await manager
      .createQueryBuilder()
      .insert()
      .into(OrganizerLedgerEntry)
      .values({
        organizerId,
        orderId: null,
        entryType: LedgerEntryType.PAYOUT,
        amountCents: -amountCents,
        currency,
        idempotencyKey,
        metadata: { payoutBatchId: batchId, payoutBatchLineId: batchLineId },
      })
      .orIgnore()
      .execute();
  }

  async sumLedgerNetCents(organizerId: string): Promise<number> {
    const row = await this.dataSource
      .getRepository(OrganizerLedgerEntry)
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount_cents), 0)', 'sum')
      .where('e.organizerId = :organizerId', { organizerId })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  async sumReservedInOpenBatchesCents(organizerId: string): Promise<number> {
    const row = await this.dataSource
      .getRepository(PayoutBatchLine)
      .createQueryBuilder('line')
      .innerJoin('line.batch', 'batch')
      .select('COALESCE(SUM(line.amountCents), 0)', 'sum')
      .where('line.organizerId = :organizerId', { organizerId })
      .andWhere('batch.status IN (:...statuses)', {
        statuses: RESERVED_BATCH_STATUSES,
      })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  async getEarningsSummary(organizerId: string): Promise<{
    ledgerNetCents: number;
    reservedInOpenBatchesCents: number;
    availableCents: number;
    currency: string;
  }> {
    const ledgerNetCents = await this.sumLedgerNetCents(organizerId);
    const reservedInOpenBatchesCents =
      await this.sumReservedInOpenBatchesCents(organizerId);
    const availableCents = Math.max(
      0,
      ledgerNetCents - reservedInOpenBatchesCents,
    );
    const last = await this.dataSource.getRepository(OrganizerLedgerEntry).find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const currency = last[0]?.currency ?? 'KES';
    return {
      ledgerNetCents,
      reservedInOpenBatchesCents,
      availableCents,
      currency,
    };
  }

  async listLedgerEntries(
    organizerId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ total: number; entries: OrganizerLedgerEntry[] }> {
    const repo = this.dataSource.getRepository(OrganizerLedgerEntry);
    const [entries, total] = await repo.findAndCount({
      where: { organizerId },
      order: { createdAt: 'DESC' },
      take: opts.limit,
      skip: opts.offset,
    });
    return { total, entries };
  }
}
