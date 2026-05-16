import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { Role } from '../domain/enums';
import { OrganizerEarningsService } from './organizer-earnings.service';

@ApiTags('organizers')
@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerEarningsController {
  constructor(
    private readonly organizerEarningsService: OrganizerEarningsService,
  ) {}

  @Get('earnings/summary')
  @ApiOperation({
    summary: 'Ledger-based earnings: available balance and reservations',
  })
  async earningsSummary(@GetUser() user: CurrentUser) {
    return this.organizerEarningsService.getSummaryForUser(user.id);
  }

  @Get('earnings/ledger')
  @ApiOperation({ summary: 'Paginated organizer ledger entries' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async earningsLedger(
    @GetUser() user: CurrentUser,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.organizerEarningsService.listLedgerForUser(user.id, {
      limit,
      offset,
    });
  }
}
