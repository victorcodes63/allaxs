import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerSalesService } from './organizer-sales.service';
import { OrganizerTicketsService } from './organizer-tickets.service';

@ApiTags('organizers')
@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerSalesController {
  constructor(
    private readonly organizerSalesService: OrganizerSalesService,
    private readonly organizerTicketsService: OrganizerTicketsService,
  ) {}

  @Get('sales/summary')
  @ApiOperation({
    summary: 'Per-event sales aggregates for the authenticated organizer',
  })
  async salesSummary(@GetUser() user: CurrentUser) {
    return this.organizerSalesService.getSalesSummary(user.id);
  }

  @Get('sales/orders')
  @ApiOperation({ summary: 'Paginated orders across organizer events' })
  @ApiQuery({ name: 'eventId', required: false, description: 'Filter by event' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async salesOrders(
    @GetUser() user: CurrentUser,
    @Query('eventId') eventId?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.organizerSalesService.listOrders(user.id, {
      eventId: eventId?.trim() || undefined,
      limit,
      offset,
    });
  }

  @Get('sales/events/:eventId/attendees/export')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({
    summary: 'Export paid ticket holders for one event as CSV',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  async exportAttendees(
    @GetUser() user: CurrentUser,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Res() res: Response,
  ) {
    const { csv, filename } =
      await this.organizerTicketsService.exportAttendeesCsv(
        user.id,
        user.roles,
        eventId,
      );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
