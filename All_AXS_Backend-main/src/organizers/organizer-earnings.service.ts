import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { LedgerEntryType } from '../domain/enums';
import type { OrganizerLedgerEntry } from '../domain/organizer-ledger-entry.entity';

function entryTypeLabel(t: LedgerEntryType): string {
  switch (t) {
    case LedgerEntryType.ORDER_EARNINGS:
      return 'Ticket sale (net)';
    case LedgerEntryType.ORDER_REFUND_REVERSAL:
      return 'Refund reversal';
    case LedgerEntryType.PAYOUT:
      return 'Payout';
    default:
      return t;
  }
}

@Injectable()
export class OrganizerEarningsService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    private readonly organizerLedgerService: OrganizerLedgerService,
  ) {}

  private async requireProfile(userId: string): Promise<OrganizerProfile> {
    const profile = await this.organizerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Organizer profile not found');
    }
    return profile;
  }

  async getSummaryForUser(userId: string) {
    const profile = await this.requireProfile(userId);
    const summary = await this.organizerLedgerService.getEarningsSummary(
      profile.id,
    );
    return {
      organizerId: profile.id,
      orgName: profile.orgName,
      currency: summary.currency,
      ledgerNetCents: summary.ledgerNetCents,
      reservedInOpenBatchesCents: summary.reservedInOpenBatchesCents,
      availableCents: summary.availableCents,
    };
  }

  async listLedgerForUser(
    userId: string,
    params: { limit: number; offset: number },
  ) {
    const profile = await this.requireProfile(userId);
    const { total, entries } =
      await this.organizerLedgerService.listLedgerEntries(profile.id, params);
    return {
      organizerId: profile.id,
      total,
      entries: entries.map((e) => this.serializeLedgerEntry(e)),
    };
  }

  private serializeLedgerEntry(e: OrganizerLedgerEntry) {
    return {
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      entryType: e.entryType,
      entryTypeLabel: entryTypeLabel(e.entryType),
      amountCents: e.amountCents,
      currency: e.currency,
      orderId: e.orderId ?? null,
      metadata: e.metadata ?? null,
    };
  }
}
