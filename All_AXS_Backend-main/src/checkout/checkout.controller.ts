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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';
import { PaystackInitDto } from './dto/paystack-init.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';

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

  /**
   * Buyer-side coupon preview. Returns the discount the code would
   * produce against the supplied cart without locking or consuming
   * the redemption. Optional JWT so anonymous buyers can preview the
   * code before signing in; the authoritative cap check happens again
   * at redeem time.
   */
  @Post('coupons/preview')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async previewCoupon(
    @GetUser() user: CurrentUser | undefined,
    @Body() dto: CouponPreviewDto,
  ) {
    return this.checkoutService.previewCoupon(user?.id ?? null, dto);
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
