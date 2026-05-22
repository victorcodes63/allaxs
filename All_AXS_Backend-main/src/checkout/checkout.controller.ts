import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CheckoutService } from './checkout.service';
import { DemoCheckoutDto } from './dto/demo-checkout.dto';
import { PaystackInitDto } from './dto/paystack-init.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';
import { CompCheckoutInitDto } from './dto/comp-checkout-init.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  private extractMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

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
   * Public guest checkout — no prior sign-in. Auto-provisions attendee
   * accounts and returns session tokens for brand-new emails.
   */
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('guest/paystack/init')
  @HttpCode(HttpStatus.CREATED)
  async guestPaystackInit(@Body() dto: PaystackInitDto, @Req() req: Request) {
    return this.checkoutService.initializeGuestPaystackCheckout(
      dto,
      this.extractMetadata(req),
    );
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('guest/comp/init')
  @HttpCode(HttpStatus.CREATED)
  async guestCompInit(@Body() dto: CompCheckoutInitDto, @Req() req: Request) {
    return this.checkoutService.initializeCompCheckout(
      dto,
      this.extractMetadata(req),
    );
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

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('paystack/confirm-by-reference')
  async confirmPaystackByReference(@Query('reference') reference: string) {
    return this.checkoutService.confirmPaystackByReference(reference);
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
