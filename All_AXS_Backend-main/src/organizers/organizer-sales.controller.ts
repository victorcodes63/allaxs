import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerSalesService } from './organizer-sales.service';

@ApiTags('organizers')
@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerSalesController {
  constructor(private readonly organizerSalesService: OrganizerSalesService) {}

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
}
