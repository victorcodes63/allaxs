import {
  Body,
  Controller,
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
import { OrganizerPayoutRequestsService } from './organizer-payout-requests.service';
import { RequestPayoutWithdrawDto } from './dto/request-payout-withdraw.dto';

@ApiTags('organizers')
@Controller('organizers/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerPayoutRequestsController {
  constructor(
    private readonly payoutRequestsService: OrganizerPayoutRequestsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Withdrawal eligibility: available balance, minimum threshold, and any in-flight request',
  })
  async summary(@GetUser() user: CurrentUser) {
    return this.payoutRequestsService.getSummaryForUser(user.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Paginated history of withdrawal requests' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @GetUser() user: CurrentUser,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.payoutRequestsService.listForUser(user.id, { limit, offset });
  }

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a withdrawal request for admin review' })
  async createRequest(
    @GetUser() user: CurrentUser,
    @Body() dto: RequestPayoutWithdrawDto,
  ) {
    return this.payoutRequestsService.createRequest(user.id, dto.amountCents);
  }

  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel one of your own pending withdrawal requests',
  })
  @ApiParam({ name: 'id', description: 'Withdrawal request ID' })
  async cancel(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payoutRequestsService.cancelRequest(user.id, id);
  }
}
