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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';
import { PaystackInitDto } from './dto/paystack-init.dto';

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

  @Post('paystack/init')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async paystackInit(@GetUser() user: CurrentUser, @Body() dto: PaystackInitDto) {
    return this.checkoutService.initializePaystackCheckout(user.id, dto);
  }

  @Get('paystack/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmPaystack(
    @GetUser() user: CurrentUser,
    @Query('reference') reference: string,
  ) {
    return this.checkoutService.confirmPaystackPayment(user.id, reference);
  }

  @Post('orders/:orderId/resend-tickets')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendTickets(
    @GetUser() user: CurrentUser,
    @Param('orderId') orderId: string,
  ) {
    return this.checkoutService.resendTickets(user.id, orderId);
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
