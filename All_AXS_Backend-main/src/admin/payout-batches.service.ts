import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { PayoutBatch } from '../domain/payout-batch.entity';
import { PayoutBatchLine } from '../domain/payout-batch-line.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { PayoutBatchStatus } from '../domain/enums';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';

@Injectable()
export class PayoutBatchesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizerLedgerService: OrganizerLedgerService,
  ) {}

  async createDraft(
    organizerIds: string[],
    createdByUserId?: string | null,
  ): Promise<PayoutBatch> {
    const unique = [...new Set(organizerIds.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) {
      throw new BadRequestException('At least one organizer id is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const profiles = await manager.find(OrganizerProfile, {
        where: { id: In(unique) },
      });
      if (profiles.length !== unique.length) {
        throw new BadRequestException(
          'One or more organizer profiles were not found',
        );
      }

      const lineData: {
        organizerId: string;
        amountCents: number;
        currency: string;
      }[] = [];
      let currency = 'KES';

      for (const oid of unique) {
        const summary =
          await this.organizerLedgerService.getEarningsSummary(oid);
        if (summary.availableCents <= 0) {
          continue;
        }
        lineData.push({
          organizerId: oid,
          amountCents: summary.availableCents,
          currency: summary.currency,
        });
        currency = summary.currency;
      }

      if (!lineData.length) {
        throw new BadRequestException(
          'No available balance to payout for the selected organizers',
        );
      }

      const batch = manager.create(PayoutBatch, {
        status: PayoutBatchStatus.DRAFT,
        currency,
        createdByUserId: createdByUserId ?? null,
      });
      await manager.save(batch);

      for (const row of lineData) {
        await manager.save(
          manager.create(PayoutBatchLine, {
            batchId: batch.id,
            organizerId: row.organizerId,
            amountCents: row.amountCents,
            currency: row.currency,
          }),
        );
      }

      return manager.findOneOrFail(PayoutBatch, {
        where: { id: batch.id },
        relations: ['lines', 'lines.organizer'],
      });
    });
  }

  async listBatches(params: { limit: number; offset: number }): Promise<{
    batches: PayoutBatch[];
    total: number;
  }> {
    const [batches, total] = await this.dataSource
      .getRepository(PayoutBatch)
      .findAndCount({
        order: { createdAt: 'DESC' },
        take: params.limit,
        skip: params.offset,
        relations: ['lines', 'lines.organizer'],
      });
    return { batches, total };
  }

  async getBatch(id: string): Promise<PayoutBatch> {
    const batch = await this.dataSource.getRepository(PayoutBatch).findOne({
      where: { id },
      relations: ['lines', 'lines.organizer'],
    });
    if (!batch) {
      throw new NotFoundException('Payout batch not found');
    }
    return batch;
  }

  async approve(batchId: string): Promise<PayoutBatch> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) {
        throw new NotFoundException('Payout batch not found');
      }
      if (batch.status !== PayoutBatchStatus.DRAFT) {
        throw new BadRequestException('Only draft batches can be approved');
      }
      batch.status = PayoutBatchStatus.APPROVED;
      batch.approvedAt = new Date();
      await manager.save(batch);
      return manager.findOneOrFail(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines', 'lines.organizer'],
      });
    });
  }

  async markExported(batchId: string): Promise<PayoutBatch> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) {
        throw new NotFoundException('Payout batch not found');
      }
      if (batch.status !== PayoutBatchStatus.APPROVED) {
        throw new BadRequestException('Only approved batches can be exported');
      }
      batch.status = PayoutBatchStatus.EXPORTED;
      await manager.save(batch);
      return manager.findOneOrFail(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines', 'lines.organizer'],
      });
    });
  }

  async markPaid(
    batchId: string,
    externalReference: string,
  ): Promise<PayoutBatch> {
    const ref = externalReference.trim();
    if (!ref) {
      throw new BadRequestException('externalReference is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) {
        throw new NotFoundException('Payout batch not found');
      }
      if (
        batch.status !== PayoutBatchStatus.APPROVED &&
        batch.status !== PayoutBatchStatus.EXPORTED
      ) {
        throw new BadRequestException(
          'Only approved or exported batches can be marked paid',
        );
      }

      for (const line of batch.lines ?? []) {
        await this.organizerLedgerService.appendPayoutDebit(manager, {
          organizerId: line.organizerId,
          amountCents: line.amountCents,
          currency: line.currency,
          batchLineId: line.id,
          batchId: batch.id,
        });
      }

      batch.status = PayoutBatchStatus.MARKED_PAID;
      batch.externalReference = ref;
      batch.markedPaidAt = new Date();
      await manager.save(batch);

      return manager.findOneOrFail(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines', 'lines.organizer'],
      });
    });
  }

  async cancel(batchId: string): Promise<PayoutBatch> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(PayoutBatch, {
        where: { id: batchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) {
        throw new NotFoundException('Payout batch not found');
      }
      if (batch.status === PayoutBatchStatus.MARKED_PAID) {
        throw new BadRequestException('Cannot cancel a batch that was already marked paid');
      }
      if (batch.status === PayoutBatchStatus.CANCELLED) {
        return batch;
      }
      batch.status = PayoutBatchStatus.CANCELLED;
      await manager.save(batch);
      return manager.findOneOrFail(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines', 'lines.organizer'],
      });
    });
  }
}
