import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerAnalyticsService } from './organizer-analytics.service';

@ApiTags('organizers')
@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerAnalyticsController {
  constructor(
    private readonly organizerAnalyticsService: OrganizerAnalyticsService,
  ) {}

  @Get('analytics/summary')
  @ApiOperation({
    summary:
      'Funnel metrics for the authenticated organizer (optional event filter)',
  })
  @ApiQuery({
    name: 'eventId',
    required: false,
    description: 'Scope metrics to a single owned event',
  })
  async analyticsSummary(
    @GetUser() user: CurrentUser,
    @Query('eventId') eventId?: string,
  ) {
    return this.organizerAnalyticsService.getAnalyticsSummary(
      user.id,
      eventId,
    );
  }
}
