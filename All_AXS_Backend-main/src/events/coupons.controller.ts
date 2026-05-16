import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
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
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('coupons')
@Controller()
export class CouponsController {
  private readonly logger = new Logger(CouponsController.name);

  constructor(private readonly couponsService: CouponsService) {}

  @Get('events/:eventId/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List coupons for an event (organizer/admin)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Coupons returned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async list(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
  ) {
    return this.couponsService.listForEvent(eventId, user.id, user.roles);
  }

  @Post('events/:eventId/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a coupon for an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Duplicate code' })
  async create(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
    @Body() dto: CreateCouponDto,
  ) {
    try {
      return await this.couponsService.create(
        eventId,
        user.id,
        user.roles,
        dto,
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          `Error creating coupon for event ${eventId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  @Get('coupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single coupon (organizer/admin)' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({ status: 200, description: 'Coupon returned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findOne(@Param('id') id: string, @GetUser() user: CurrentUser) {
    return this.couponsService.findOne(id, user.id, user.roles);
  }

  @Patch('coupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiResponse({
    status: 409,
    description: 'Locked field changed after redemption or duplicate code',
  })
  async update(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() dto: UpdateCouponDto,
  ) {
    try {
      return await this.couponsService.update(id, user.id, user.roles, dto);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          `Error updating coupon ${id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  @Delete('coupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Remove a coupon. Hard-deletes when no redemptions exist; otherwise soft-disables (active = false).',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: 200,
    description: 'Coupon deleted or disabled',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async remove(@Param('id') id: string, @GetUser() user: CurrentUser) {
    return this.couponsService.remove(id, user.id, user.roles);
  }
}
