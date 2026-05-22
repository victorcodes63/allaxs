import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RefundRequestsService } from '../admin/refund-requests.service';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';

function extractAuditContext(req: Request) {
  return {
    ipAddress:
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      null,
    userAgent: (req.headers['user-agent'] as string) || null,
  };
}

function serializeRefundRequest(request: {
  id: string;
  orderId: string;
  email: string;
  reason: string;
  status: string;
  createdAt: Date;
  reviewedAt?: Date | null;
  adminNote?: string | null;
}) {
  return {
    id: request.id,
    orderId: request.orderId,
    email: request.email,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt ?? null,
    adminNote: request.adminNote ?? null,
  };
}

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly refundRequestsService: RefundRequestsService) {}

  @Post(':id/refund-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a refund request for a paid order (buyer)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async createRefundRequest(
    @GetUser() user: CurrentUser,
    @Param('id') orderId: string,
    @Body() dto: CreateRefundRequestDto,
    @Req() req: Request,
  ) {
    const request = await this.refundRequestsService.createRequest(
      orderId,
      user.id,
      user.email,
      dto.reason,
      extractAuditContext(req),
    );

    return {
      message: 'Refund request submitted',
      refundRequest: serializeRefundRequest(request),
    };
  }

  @Get(':id/refund-request')
  @ApiOperation({
    summary: 'Get refund request status for an owned order (buyer)',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async getRefundRequest(
    @GetUser() user: CurrentUser,
    @Param('id') orderId: string,
  ) {
    const request = await this.refundRequestsService.getForBuyer(
      orderId,
      user.id,
    );

    return {
      refundRequest: request ? serializeRefundRequest(request) : null,
    };
  }
}
