import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  async mine(
    @GetUser() user: CurrentUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;
    return this.notificationsService.listForUser(
      user,
      parsedLimit,
      parsedOffset,
    );
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@GetUser() user: CurrentUser, @Param('id') id: string) {
    return this.notificationsService.markReadForUser(id, user);
  }

  @Post('me/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@GetUser() user: CurrentUser) {
    return this.notificationsService.markAllReadForUser(user);
  }
}
