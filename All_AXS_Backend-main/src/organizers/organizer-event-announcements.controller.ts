import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerEventAnnouncementsService } from './organizer-event-announcements.service';
import { CreateEventAnnouncementDto } from './dto/create-event-announcement.dto';

@ApiTags('organizer-announcements')
@Controller('organizer/events/:eventId/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerEventAnnouncementsController {
  constructor(
    private readonly announcementsService: OrganizerEventAnnouncementsService,
  ) {}

  @Get('recipients')
  @ApiOperation({
    summary: 'Count distinct paid buyer emails for an event announcement',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { recipientCount: { type: 'number' } },
    },
  })
  async recipientCount(
    @GetUser() user: CurrentUser,
    @Param('eventId') eventId: string,
  ) {
    return this.announcementsService.countPaidBuyerRecipients(
      eventId,
      user.id,
    );
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send an email announcement to all paid buyers for an event',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        recipientCount: { type: 'number' },
        sentCount: { type: 'number' },
        failedCount: { type: 'number' },
      },
    },
  })
  async sendAnnouncement(
    @GetUser() user: CurrentUser,
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventAnnouncementDto,
  ) {
    return this.announcementsService.sendAnnouncement(eventId, user.id, dto);
  }
}
