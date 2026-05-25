import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { PayoutBatch } from '../domain/payout-batch.entity';
import { PayoutBatchLine } from '../domain/payout-batch-line.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { PayoutBatchStatus, PayoutMethod } from '../domain/enums';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import {
  normalizeCurrencyCode,
  PLATFORM_DEFAULT_CURRENCY,
} from '../common/currency';
import { DarajaB2cService } from '../payments/daraja-b2c.service';

@Injectable()
export class PayoutBatchesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizerLedgerService: OrganizerLedgerService,
    private readonly darajaB2cService: DarajaB2cService,
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
      let batchCurrency = '';

      for (const oid of unique) {
        const summary =
          await this.organizerLedgerService.getEarningsSummary(oid);
        if (summary.availableCents <= 0) {
          continue;
        }
        const lineCurrency = normalizeCurrencyCode(summary.currency);
        if (
          batchCurrency &&
          batchCurrency !== lineCurrency
        ) {
          throw new BadRequestException(
            'Selected organizers must share the same payout currency',
          );
        }
        batchCurrency = batchCurrency || lineCurrency;
        lineData.push({
          organizerId: oid,
          amountCents: summary.availableCents,
          currency: lineCurrency,
        });
      }

      if (!lineData.length) {
        throw new BadRequestException(
          'No available balance to payout for the selected organizers',
        );
      }

      const batch = manager.create(PayoutBatch, {
        status: PayoutBatchStatus.DRAFT,
        currency: batchCurrency || lineData[0]?.currency || PLATFORM_DEFAULT_CURRENCY,
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

  /**
   * Organizers with a positive available balance (ledger net minus open batch
   * reservations). Used by admin UI to pick payout batch lines via checkboxes.
   */
  async listEligibleOrganizers(): Promise<{
    organizers: {
      id: string;
      orgName: string;
      supportEmail: string;
      userEmail: string | null;
      payoutMethod: PayoutMethod | null;
      verified: boolean;
      availableCents: number;
      reservedInOpenBatchesCents: number;
      ledgerNetCents: number;
      currency: string;
    }[];
  }> {
    const profiles = await this.dataSource.getRepository(OrganizerProfile).find({
      relations: ['user'],
      order: { orgName: 'ASC' },
    });

    const organizers: {
      id: string;
      orgName: string;
      supportEmail: string;
      userEmail: string | null;
      payoutMethod: PayoutMethod | null;
      verified: boolean;
      availableCents: number;
      reservedInOpenBatchesCents: number;
      ledgerNetCents: number;
      currency: string;
    }[] = [];

    for (const profile of profiles) {
      const summary =
        await this.organizerLedgerService.getEarningsSummary(profile.id);
      if (summary.availableCents <= 0) {
        continue;
      }
      organizers.push({
        id: profile.id,
        orgName: profile.orgName,
        supportEmail: profile.supportEmail,
        userEmail: profile.user?.email ?? null,
        payoutMethod: profile.payoutMethod ?? null,
        verified: profile.verified,
        availableCents: summary.availableCents,
        reservedInOpenBatchesCents: summary.reservedInOpenBatchesCents,
        ledgerNetCents: summary.ledgerNetCents,
        currency: normalizeCurrencyCode(summary.currency),
      });
    }

    organizers.sort((a, b) => b.availableCents - a.availableCents);

    return { organizers };
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

  async disburse(batchId: string): Promise<PayoutBatch> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(PayoutBatch, {
        where: { id: batchId },
        relations: ['lines', 'lines.organizer'],
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
          'Only approved or exported batches can be disbursed',
        );
      }

      for (const line of batch.lines ?? []) {
        if (line.disbursedAt) {
          continue;
        }

        const organizer = line.organizer;
        if (!organizer || organizer.payoutMethod !== PayoutMethod.MPESA) {
          continue;
        }

        const phone =
          organizer.supportPhone?.trim() ||
          (typeof organizer.payoutDetails?.phone === 'string'
            ? organizer.payoutDetails.phone.trim()
            : '');

        if (!phone) {
          line.disbursementError =
            'M-Pesa payout phone is missing (set support phone on organizer profile)';
          await manager.save(line);
          continue;
        }

        try {
          const result = await this.darajaB2cService.initiateB2cPayment({
            amountCents: line.amountCents,
            phone,
            accountReference: `batch-${batch.id}`,
            remarks: `Payout ${organizer.orgName}`.slice(0, 100),
          });
          line.disbursedAt = new Date();
          line.disbursementError = null;
          line.externalReference = result.conversationId;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Daraja B2C payout failed';
          line.disbursementError = message;
        }
        await manager.save(line);
      }

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
