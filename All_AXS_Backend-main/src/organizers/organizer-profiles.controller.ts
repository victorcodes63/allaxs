import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailVerificationService } from '../auth/services/email-verification.service';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { CreateOrUpdateOrganizerProfileDto } from './dto/create-or-update-organizer-profile.dto';

@Controller('organizers')
@UseGuards(JwtAuthGuard)
export class OrganizerProfilesController {
  constructor(
    private readonly organizerProfilesService: OrganizerProfilesService,
    private readonly emailVerificationService: EmailVerificationService,
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
    const verified = await this.emailVerificationService.isUserVerified(user.id);
    if (!verified) {
      throw new ForbiddenException({
        message: 'Verify your email before setting up a host account.',
        code: 'emailNotVerified',
      });
    }

    const profile = await this.organizerProfilesService.upsertForUser(
      user.id,
      dto,
    );

    return this.organizerProfilesService.serializeOrganizerProfile(profile);
  }
}
