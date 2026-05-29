import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerWaitlistService } from './organizer-waitlist.service';

@ApiTags('organizers')
@Controller('organizers/waitlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerWaitlistController {
  constructor(private readonly waitlistService: OrganizerWaitlistService) {}

  @Get()
  @ApiOperation({ summary: 'List waitlist entries across organizer events' })
  @ApiQuery({ name: 'eventId', required: false })
  list(
    @GetUser() user: CurrentUser,
    @Query('eventId') eventId?: string,
  ) {
    return this.waitlistService.listForUser(user.id, eventId?.trim() || undefined);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a waitlist entry' })
  @ApiParam({ name: 'id', description: 'Waitlist entry ID' })
  cancel(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.waitlistService.cancelForUser(user.id, id);
  }

  @Post(':id/notify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notify the next buyer on the waitlist manually' })
  @ApiParam({ name: 'id', description: 'Waitlist entry ID' })
  notify(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.waitlistService.notifyForUser(user.id, id);
  }
}
