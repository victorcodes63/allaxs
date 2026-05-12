import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CheckoutService } from './checkout.service';

@Controller('api/webhooks')
export class PaystackWebhookController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer; body: unknown },
  ) {
    return this.checkoutService.processPaystackWebhook(
      signature,
      req.rawBody,
      req.body,
    );
  }
}
