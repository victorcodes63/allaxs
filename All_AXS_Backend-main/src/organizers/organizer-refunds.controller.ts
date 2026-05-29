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
import { OrganizerRefundsService } from './organizer-refunds.service';
import { ReviewOrganizerRefundDto } from './dto/review-organizer-refund.dto';
import { InitiateOrganizerRefundDto } from './dto/initiate-organizer-refund.dto';

@ApiTags('organizers')
@Controller('organizers/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerRefundsController {
  constructor(private readonly refundsService: OrganizerRefundsService) {}

  @Get()
  @ApiOperation({ summary: 'List refund requests for organizer-owned events' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'REQUESTED | APPROVED | DENIED | REFUNDED | ALL',
  })
  list(
    @GetUser() user: CurrentUser,
    @Query('status') status?: string,
  ) {
    const normalized =
      status?.trim().toUpperCase() === 'ALL' ? undefined : status;
    return this.refundsService.listForUser(user.id, normalized);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a refund for an order on your event' })
  initiate(
    @GetUser() user: CurrentUser,
    @Body() dto: InitiateOrganizerRefundDto,
  ) {
    return this.refundsService.initiateForUser(user.id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a buyer refund request' })
  @ApiParam({ name: 'id', description: 'Refund request ID' })
  approve(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewOrganizerRefundDto,
  ) {
    return this.refundsService.approveForUser(user.id, id, dto);
  }

  @Post(':id/deny')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deny a buyer refund request' })
  @ApiParam({ name: 'id', description: 'Refund request ID' })
  deny(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewOrganizerRefundDto,
  ) {
    return this.refundsService.denyForUser(user.id, id, dto);
  }
}
