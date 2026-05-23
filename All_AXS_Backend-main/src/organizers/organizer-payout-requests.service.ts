import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { PayoutWithdrawRequestStatus } from '../domain/enums';
import { PayoutWithdrawRequest } from './entities/payout-withdraw-request.entity';
import {
  getProfessionalPayoutProfileViolations,
  type OrganizerPayoutProfileFields,
} from './organizer-payout-profile.validation';
import { MIN_WITHDRAWAL_CENTS } from './dto/request-payout-withdraw.dto';

type ListParams = {
  limit: number;
  offset: number;
};

@Injectable()
export class OrganizerPayoutRequestsService {
  /** Floor for any single withdrawal request (KES 5,000 in minor units). */
  static readonly MIN_WITHDRAWAL_CENTS = MIN_WITHDRAWAL_CENTS;

  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(PayoutWithdrawRequest)
    private readonly payoutWithdrawRequestRepository: Repository<PayoutWithdrawRequest>,
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

  private profileToValidationFields(
    profile: OrganizerProfile,
  ): OrganizerPayoutProfileFields {
    const payoutDetails = (profile.payoutDetails ?? {}) as {
      instructions?: string;
    };
    return {
      orgName: profile.orgName,
      legalName: profile.legalName ?? null,
      supportEmail: profile.supportEmail,
      supportPhone: profile.supportPhone ?? null,
      payoutMethod: profile.payoutMethod ?? null,
      bankName: profile.bankName ?? null,
      bankAccountName: profile.bankAccountName ?? null,
      bankAccountNumber: profile.bankAccountNumber ?? null,
      mpesaPaybill: profile.mpesaPaybill ?? null,
      mpesaTillNumber: profile.mpesaTillNumber ?? null,
      payoutInstructions: payoutDetails.instructions ?? null,
      taxId: profile.taxId ?? null,
    };
  }

  private isReadyForSettlement(profile: OrganizerProfile): {
    ready: boolean;
    violations: string[];
    adminVerified: boolean;
  } {
    const violations = getProfessionalPayoutProfileViolations(
      this.profileToValidationFields(profile),
    );
    return {
      ready: violations.length === 0 && profile.verified,
      violations,
      adminVerified: profile.verified,
    };
  }

  /**
   * Snapshot of the organizer's withdrawal eligibility:
   * available balance, the configured floor, and any in-flight request.
   * Powers the dashboard widget that drives the "Withdraw" CTA.
   */
  async getSummaryForUser(userId: string) {
    const profile = await this.requireProfile(userId);
    const readiness = this.isReadyForSettlement(profile);
    const ledger = await this.organizerLedgerService.getEarningsSummary(
      profile.id,
    );

    const pending = await this.payoutWithdrawRequestRepository.findOne({
      where: {
        organizerProfileId: profile.id,
        status: PayoutWithdrawRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      organizerId: profile.id,
      currency: ledger.currency,
      availableCents: ledger.availableCents,
      ledgerNetCents: ledger.ledgerNetCents,
      reservedInOpenBatchesCents: ledger.reservedInOpenBatchesCents,
      minWithdrawalCents:
        OrganizerPayoutRequestsService.MIN_WITHDRAWAL_CENTS,
      canRequest:
        readiness.ready &&
        !pending &&
        ledger.availableCents >=
          OrganizerPayoutRequestsService.MIN_WITHDRAWAL_CENTS,
      readyForSettlement: readiness.ready,
      adminVerified: readiness.adminVerified,
      profileViolations: readiness.violations,
      pendingRequest: pending ? this.serialize(pending) : null,
    };
  }

  async listForUser(userId: string, params: ListParams) {
    const profile = await this.requireProfile(userId);
    const [requests, total] =
      await this.payoutWithdrawRequestRepository.findAndCount({
        where: { organizerProfileId: profile.id },
        order: { createdAt: 'DESC' },
        take: params.limit,
        skip: params.offset,
      });

    return {
      organizerId: profile.id,
      total,
      limit: params.limit,
      offset: params.offset,
      requests: requests.map((r) => this.serialize(r)),
    };
  }

  async createRequest(userId: string, amountCents: number) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException('amountCents must be a positive integer');
    }

    const profile = await this.requireProfile(userId);
    const readiness = this.isReadyForSettlement(profile);
    if (!readiness.ready) {
      throw new BadRequestException({
        message:
          'Your payout profile is not yet ready for settlement. Complete the missing items and wait for admin verification.',
        violations: readiness.violations,
        adminVerified: readiness.adminVerified,
      });
    }

    if (amountCents < OrganizerPayoutRequestsService.MIN_WITHDRAWAL_CENTS) {
      throw new BadRequestException(
        `Minimum withdrawal is ${OrganizerPayoutRequestsService.MIN_WITHDRAWAL_CENTS} (minor units).`,
      );
    }

    const ledger = await this.organizerLedgerService.getEarningsSummary(
      profile.id,
    );
    if (amountCents > ledger.availableCents) {
      throw new BadRequestException(
        'Requested amount exceeds your available balance.',
      );
    }

    const inflight = await this.payoutWithdrawRequestRepository.findOne({
      where: {
        organizerProfileId: profile.id,
        status: PayoutWithdrawRequestStatus.PENDING,
      },
    });
    if (inflight) {
      throw new BadRequestException(
        'You already have a pending withdrawal request. Cancel it before submitting another.',
      );
    }

    const request = this.payoutWithdrawRequestRepository.create({
      organizerProfileId: profile.id,
      amountCents,
      currency: ledger.currency,
      status: PayoutWithdrawRequestStatus.PENDING,
      metadata: {
        availableAtRequestCents: ledger.availableCents,
        ledgerNetAtRequestCents: ledger.ledgerNetCents,
      },
    });

    const saved = await this.payoutWithdrawRequestRepository.save(request);
    return this.serialize(saved);
  }

  async cancelRequest(userId: string, requestId: string) {
    const profile = await this.requireProfile(userId);
    const request = await this.payoutWithdrawRequestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }
    if (request.organizerProfileId !== profile.id) {
      throw new NotFoundException('Withdrawal request not found');
    }
    if (request.status !== PayoutWithdrawRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending withdrawal requests can be cancelled',
      );
    }

    request.status = PayoutWithdrawRequestStatus.CANCELLED;
    request.processedAt = new Date();
    request.metadata = {
      ...(request.metadata ?? {}),
      cancelledBy: 'organizer',
      cancelledAt: new Date().toISOString(),
    };
    const saved = await this.payoutWithdrawRequestRepository.save(request);
    return this.serialize(saved);
  }

  private serialize(r: PayoutWithdrawRequest) {
    return {
      id: r.id,
      organizerProfileId: r.organizerProfileId,
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status,
      requestedAt: r.requestedAt?.toISOString() ?? r.createdAt.toISOString(),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      adminNote: r.adminNote ?? null,
      metadata: r.metadata ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
