import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('waitlist')
@Controller()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('events/:eventId/ticket-types/:tierId/waitlist')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join the waitlist for a sold-out ticket tier' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({ name: 'tierId', description: 'Ticket tier ID' })
  async join(
    @Param('eventId') eventId: string,
    @Param('tierId') tierId: string,
    @Body() dto: JoinWaitlistDto,
    @GetUser() user?: CurrentUser,
  ) {
    return this.waitlistService.join(
      eventId,
      tierId,
      dto.email,
      user?.id,
    );
  }

  @Public()
  @Get('events/waitlist/verify')
  @ApiOperation({ summary: 'Verify a waitlist purchase token' })
  async verify(@Query('token') token: string) {
    if (!token?.trim()) {
      return { valid: false, reason: 'Token is required' };
    }
    return this.waitlistService.verifyPurchaseToken(token.trim());
  }
}
