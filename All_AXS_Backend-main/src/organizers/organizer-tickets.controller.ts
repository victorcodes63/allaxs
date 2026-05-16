import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, TicketStatus } from '../domain/enums';
import { OrganizerTicketsService } from './organizer-tickets.service';
import { UpdateOrganizerTicketDto } from './dto/update-organizer-ticket.dto';
import { TicketScanService } from '../scan/ticket-scan.service';
import { ScanTicketDto } from '../scan/dto/scan-ticket.dto';

@ApiTags('organizers')
@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerTicketsController {
  constructor(
    private readonly organizerTicketsService: OrganizerTicketsService,
    private readonly ticketScanService: TicketScanService,
  ) {}

  @Get('tickets')
  @ApiOperation({
    summary: 'Issued tickets for the organizer’s events (paid orders)',
  })
  @ApiQuery({ name: 'eventId', required: false, description: 'Filter by event' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TicketStatus,
    description: 'Filter by ticket status',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search attendee email/name, buyer email, ticket or order id',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listTickets(
    @GetUser() user: CurrentUser,
    @Query('eventId') eventId?: string,
    @Query(
      'status',
      new ParseEnumPipe(TicketStatus, { optional: true }),
    )
    status?: TicketStatus,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.organizerTicketsService.listTickets(user.id, {
      eventId: eventId?.trim() || undefined,
      status,
      q: q?.trim() || undefined,
      limit,
      offset,
    });
  }

  @Post('tickets/scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify or check in a ticket from QR payload (organizer events only)',
  })
  async scanTicket(@GetUser() user: CurrentUser, @Body() body: ScanTicketDto) {
    return this.ticketScanService.scanForOrganizer(
      user.id,
      body.payload,
      body.action,
      body.gateId,
      body.deviceId,
    );
  }

  @Patch('tickets/:id')
  @ApiOperation({
    summary: 'Update ticket status (check-in, void, or undo check-in)',
  })
  async patchTicket(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateOrganizerTicketDto,
  ) {
    return this.organizerTicketsService.updateTicketStatus(
      user.id,
      id,
      body.status,
    );
  }
}
