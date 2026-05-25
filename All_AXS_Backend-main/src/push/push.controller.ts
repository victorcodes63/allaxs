import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushSubscribeDto } from './dto/push-subscribe.dto';
import { WebPushService } from './web-push.service';

@Controller('push')
export class PushController {
  constructor(private readonly webPushService: WebPushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return {
      publicKey: this.webPushService.getPublicKey(),
      enabled: this.webPushService.isEnabled(),
    };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @GetUser() user: CurrentUser,
    @Body() body: PushSubscribeDto,
  ): Promise<void> {
    await this.webPushService.subscribe(user.id, {
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: body.userAgent,
    });
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @GetUser() user: CurrentUser,
    @Body() body: Pick<PushSubscribeDto, 'endpoint'>,
  ): Promise<void> {
    await this.webPushService.unsubscribe(user.id, body.endpoint);
  }
}
