import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrUpdateOrganizerProfileDto } from './dto/create-or-update-organizer-profile.dto';
import { Role } from '../domain/enums';
import {
  getProfessionalPayoutProfileViolations,
  type OrganizerPayoutProfileFields,
} from './organizer-payout-profile.validation';

function payoutInstructionsFromEntity(profile: OrganizerProfile): string {
  const d = profile.payoutDetails;
  if (d && typeof d === 'object' && d !== null && 'instructions' in d) {
    return String((d as { instructions?: string }).instructions ?? '').trim();
  }
  return '';
}

@Injectable()
export class OrganizerProfilesService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Find organizer profile by user ID
   */
  async findByUserId(userId: string): Promise<OrganizerProfile | null> {
    return this.organizerProfileRepository.findOne({
      where: { userId },
    });
  }

  mergeDtoWithProfile(
    existing: OrganizerProfile | null,
    dto: CreateOrUpdateOrganizerProfileDto,
  ): OrganizerPayoutProfileFields {
    const fromEntity = existing
      ? payoutInstructionsFromEntity(existing)
      : '';
    const instr =
      dto.payoutInstructions !== undefined
        ? (dto.payoutInstructions ?? '')
        : fromEntity;

    return {
      orgName: dto.orgName ?? existing?.orgName,
      legalName: dto.legalName ?? existing?.legalName,
      supportEmail: dto.supportEmail ?? existing?.supportEmail,
      supportPhone: dto.supportPhone ?? existing?.supportPhone,
      payoutMethod: dto.payoutMethod ?? existing?.payoutMethod,
      bankName: dto.bankName ?? existing?.bankName,
      bankAccountName: dto.bankAccountName ?? existing?.bankAccountName,
      bankAccountNumber: dto.bankAccountNumber ?? existing?.bankAccountNumber,
      mpesaPaybill: dto.mpesaPaybill ?? existing?.mpesaPaybill,
      mpesaTillNumber: dto.mpesaTillNumber ?? existing?.mpesaTillNumber,
      taxId: dto.taxId ?? existing?.taxId,
      payoutInstructions: instr,
    };
  }

  assertProfessionalPayoutProfile(dto: CreateOrUpdateOrganizerProfileDto): void {
    const merged = this.mergeDtoWithProfile(null, dto);
    const violations = getProfessionalPayoutProfileViolations(merged);
    if (violations.length > 0) {
      throw new BadRequestException({
        message:
          'Payout profile does not meet professional requirements. Fix the listed items and try again.',
        violations,
      });
    }
  }

  assertProfessionalPayoutProfileUpdate(
    existing: OrganizerProfile,
    dto: CreateOrUpdateOrganizerProfileDto,
  ): void {
    const merged = this.mergeDtoWithProfile(existing, dto);
    const violations = getProfessionalPayoutProfileViolations(merged);
    if (violations.length > 0) {
      throw new BadRequestException({
        message:
          'Payout profile does not meet professional requirements. Fix the listed items and try again.',
        violations,
      });
    }
  }

  serializeOrganizerProfile(profile: OrganizerProfile): Record<string, unknown> {
    const payoutInstructions = payoutInstructionsFromEntity(profile);
    const merged: OrganizerPayoutProfileFields = {
      orgName: profile.orgName,
      legalName: profile.legalName,
      supportEmail: profile.supportEmail,
      supportPhone: profile.supportPhone,
      payoutMethod: profile.payoutMethod,
      bankName: profile.bankName,
      bankAccountName: profile.bankAccountName,
      bankAccountNumber: profile.bankAccountNumber,
      mpesaPaybill: profile.mpesaPaybill,
      mpesaTillNumber: profile.mpesaTillNumber,
      taxId: profile.taxId,
      payoutInstructions,
    };
    const violations = getProfessionalPayoutProfileViolations(merged);
    const isComplete = violations.length === 0;
    return {
      id: profile.id,
      userId: profile.userId,
      orgName: profile.orgName,
      legalName: profile.legalName ?? null,
      website: profile.website ?? null,
      supportEmail: profile.supportEmail,
      supportPhone: profile.supportPhone ?? null,
      payoutMethod: profile.payoutMethod ?? null,
      bankName: profile.bankName ?? null,
      bankAccountName: profile.bankAccountName ?? null,
      bankAccountNumber: profile.bankAccountNumber ?? null,
      mpesaPaybill: profile.mpesaPaybill ?? null,
      mpesaTillNumber: profile.mpesaTillNumber ?? null,
      taxId: profile.taxId ?? null,
      payoutInstructions: payoutInstructions || null,
      payoutDetails: profile.payoutDetails ?? null,
      verified: profile.verified,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      payoutProfile: {
        isComplete,
        missingItems: violations,
        adminVerified: profile.verified,
        readyForSettlement: isComplete && profile.verified,
      },
    };
  }

  /**
   * Create or update organizer profile for a user
   * Automatically adds ORGANIZER role to user if not present
   */
  async upsertForUser(
    userId: string,
    dto: CreateOrUpdateOrganizerProfileDto,
  ): Promise<OrganizerProfile> {
    let profile = await this.findByUserId(userId);

    if (profile) {
      this.assertProfessionalPayoutProfileUpdate(profile, dto);
      const { payoutInstructions, ...restDto } = dto;
      Object.assign(profile, restDto);

      if (payoutInstructions !== undefined) {
        profile.payoutDetails = {
          ...(profile.payoutDetails || {}),
          instructions: payoutInstructions,
        };
      }

      profile = await this.organizerProfileRepository.save(profile);
    } else {
      this.assertProfessionalPayoutProfile(dto);
      const { payoutInstructions, ...restDto } = dto;
      profile = this.organizerProfileRepository.create({
        userId,
        ...restDto,
        payoutDetails: payoutInstructions
          ? { instructions: payoutInstructions }
          : undefined,
      });
      profile = await this.organizerProfileRepository.save(profile);

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (user) {
        const currentRoles = user.roles ?? [];
        if (!currentRoles.includes(Role.ORGANIZER)) {
          user.roles = [...currentRoles, Role.ORGANIZER];
          await this.userRepository.save(user);
        }
      }
    }

    return profile;
  }
}
