import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('demo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async demoCheckout(
    @GetUser() user: CurrentUser,
    @Body() dto: DemoCheckoutDto,
  ) {
    return this.checkoutService.completeDemoCheckout(user.id, dto);
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  async orderSummary(
    @GetUser() user: CurrentUser,
    @Param('orderId') orderId: string,
  ) {
    return this.checkoutService.getOrderSummaryForUser(user.id, orderId);
  }
}
