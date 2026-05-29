import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { UpdateOrganizerStoreDto } from './dto/update-organizer-store.dto';

export type OrganizerStorePayload = {
  slug: string;
  bio: string;
  logoUrl: string;
  brandColor: string;
  isPublic: boolean;
};

@Injectable()
export class OrganizerStoreService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
  ) {}

  private async getProfileOrThrow(userId: string): Promise<OrganizerProfile> {
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

  serialize(profile: OrganizerProfile): OrganizerStorePayload {
    return {
      slug: profile.storeSlug ?? '',
      bio: profile.bio ?? '',
      logoUrl: profile.logoUrl ?? '',
      brandColor: profile.brandColor ?? '#F07241',
      isPublic: profile.storePublic !== false,
    };
  }

  async getForUser(userId: string): Promise<OrganizerStorePayload> {
    const profile = await this.getProfileOrThrow(userId);
    return this.serialize(profile);
  }

  async updateForUser(
    userId: string,
    dto: UpdateOrganizerStoreDto,
  ): Promise<OrganizerStorePayload> {
    const profile = await this.getProfileOrThrow(userId);

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug) {
        const taken = await this.organizerProfileRepository.findOne({
          where: { storeSlug: slug },
          select: ['id'],
        });
        if (taken && taken.id !== profile.id) {
          throw new ConflictException('That store slug is already in use');
        }
        profile.storeSlug = slug;
      } else {
        profile.storeSlug = null;
      }
    }

    if (dto.bio !== undefined) {
      profile.bio = dto.bio.trim() || null;
    }
    if (dto.logoUrl !== undefined) {
      profile.logoUrl = dto.logoUrl.trim() || null;
    }
    if (dto.brandColor !== undefined) {
      profile.brandColor = dto.brandColor.trim() || null;
    }
    if (dto.isPublic !== undefined) {
      profile.storePublic = dto.isPublic;
    }

    if (profile.storePublic && !profile.storeSlug) {
      throw new BadRequestException(
        'Set a store slug before publishing your public store',
      );
    }

    const saved = await this.organizerProfileRepository.save(profile);
    return this.serialize(saved);
  }
}
