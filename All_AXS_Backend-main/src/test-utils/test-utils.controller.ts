import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/domain/enums';
import { PaymentPlansService } from 'src/domain/payment-plans.service';
import { PaymentProgressHelper } from 'src/domain/payment-progress.helper';
import { OrderWithPaymentDto } from 'src/domain/dto/order-with-payment.dto';

@ApiTags('test-utils')
@Controller('test-utils')
export class TestUtilsController {
  constructor(
    private readonly paymentPlansService: PaymentPlansService,
    private readonly paymentProgressHelper: PaymentProgressHelper,
  ) {}

  @Post('orders/:id/installments/mark-paid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER, Role.ATTENDEE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark installment as paid (test only)',
    description:
      'Simulates payment of an installment. Only available in non-production environments.',
  })
  @ApiResponse({ status: 200, description: 'Installment marked as paid' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Order or installment not found' })
  async markInstallmentPaid(
    @Param('id') orderId: string,
    @Body() body: { sequence: number },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'This endpoint is only available in non-production environments',
      );
    }

    // TODO: Add ownership check - user can only mark paid for their own orders
    // unless they are admin/organizer

    const result = await this.paymentPlansService.markInstallmentPaid(
      orderId,
      body.sequence,
    );

    // Return DTO with paymentSummary
    const progress =
      await this.paymentProgressHelper.getOrderPaymentProgress(orderId);
    return {
      plan: result.plan,
      order: OrderWithPaymentDto.fromOrder(result.order, progress),
    };
  }

  @Post('orders/:id/installments/mark-defaulted')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER, Role.ATTENDEE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark payment plan as defaulted (test only)',
    description:
      'Simulates default on payment plan. Only available in non-production environments.',
  })
  @ApiResponse({ status: 200, description: 'Payment plan marked as defaulted' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Order or payment plan not found' })
  async markDefaulted(@Param('id') orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'This endpoint is only available in non-production environments',
      );
    }

    // TODO: Add ownership check - user can only mark defaulted for their own orders
    // unless they are admin/organizer

    const result = await this.paymentPlansService.markDefaulted(orderId);

    // Return DTO with paymentSummary (will be null for defaulted orders)
    return {
      plan: result.plan,
      order: OrderWithPaymentDto.fromOrder(result.order, null),
    };
  }
}
