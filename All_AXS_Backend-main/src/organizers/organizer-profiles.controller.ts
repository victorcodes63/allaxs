import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { CreateOrUpdateOrganizerProfileDto } from './dto/create-or-update-organizer-profile.dto';

@Controller('organizers')
@UseGuards(JwtAuthGuard)
export class OrganizerProfilesController {
  constructor(
    private readonly organizerProfilesService: OrganizerProfilesService,
  ) {}

  @Get('profile')
  async getMyProfile(@GetUser() user: CurrentUser) {
    const profile = await this.organizerProfilesService.findByUserId(user.id);

    if (!profile) {
      throw new NotFoundException('Organizer profile not found');
    }

    return this.organizerProfilesService.serializeOrganizerProfile(profile);
  }

  @Post('profile')
  async upsertMyProfile(
    @GetUser() user: CurrentUser,
    @Body() dto: CreateOrUpdateOrganizerProfileDto,
  ) {
    const profile = await this.organizerProfilesService.upsertForUser(
      user.id,
      dto,
    );

    return this.organizerProfilesService.serializeOrganizerProfile(profile);
  }
}
