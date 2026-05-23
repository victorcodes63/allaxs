import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { OrganizerCustomersService } from './organizer-customers.service';

@ApiTags('organizers')
@Controller('organizers/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerCustomersController {
  constructor(
    private readonly organizerCustomersService: OrganizerCustomersService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Aggregate distinct buyers across the authenticated organizer events',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Optional search across buyer email / notes',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listCustomers(
    @GetUser() user: CurrentUser,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.organizerCustomersService.listCustomers(user.id, {
      q: q?.trim() || undefined,
      limit,
      offset,
    });
  }

  @Get(':email/orders')
  @ApiOperation({
    summary: 'List orders placed by a single buyer email on owned events',
  })
  @ApiParam({ name: 'email', description: 'Buyer email (URL-encoded)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listCustomerOrders(
    @GetUser() user: CurrentUser,
    @Param('email') email: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    return this.organizerCustomersService.listOrdersForCustomerEmail(
      user.id,
      decodeURIComponent(email),
      { limit, offset },
    );
  }
}
