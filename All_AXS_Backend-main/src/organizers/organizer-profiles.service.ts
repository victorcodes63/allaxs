import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrUpdateOrganizerProfileDto } from './dto/create-or-update-organizer-profile.dto';
import { Role } from '../domain/enums';

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

  /**
   * Create or update organizer profile for a user
   * Automatically adds ORGANIZER role to user if not present
   */
  async upsertForUser(
    userId: string,
    dto: CreateOrUpdateOrganizerProfileDto,
  ): Promise<OrganizerProfile> {
    // Find existing profile
    let profile = await this.findByUserId(userId);

    if (profile) {
      // Update existing profile
      const { payoutInstructions, ...restDto } = dto;
      Object.assign(profile, restDto);

      // Map payoutInstructions to payoutDetails if provided
      if (payoutInstructions !== undefined) {
        profile.payoutDetails = {
          ...(profile.payoutDetails || {}),
          instructions: payoutInstructions,
        };
      }

      profile = await this.organizerProfileRepository.save(profile);
    } else {
      // Create new profile
      const { payoutInstructions, ...restDto } = dto;
      profile = this.organizerProfileRepository.create({
        userId,
        ...restDto,
        payoutDetails: payoutInstructions
          ? { instructions: payoutInstructions }
          : undefined,
      });
      profile = await this.organizerProfileRepository.save(profile);

      // Add ORGANIZER role to user if not present
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
