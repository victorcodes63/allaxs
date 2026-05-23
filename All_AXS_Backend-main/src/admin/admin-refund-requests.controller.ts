import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, RefundRequestStatus } from '../domain/enums';
import { RefundRequestsService } from './refund-requests.service';
import { ReviewRefundRequestDto } from './dto/review-refund-request.dto';
import type { RefundRequest } from '../domain/refund-request.entity';

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

function serializeRefundRequestRow(request: RefundRequest) {
  const order = request.order;
  const event = order?.event;

  return {
    id: request.id,
    orderId: request.orderId,
    email: request.email,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt ?? null,
    adminNote: request.adminNote ?? null,
    order: order
      ? {
          id: order.id,
          status: order.status,
          amountCents: order.amountCents,
          currency: order.currency,
          reference: order.reference ?? null,
        }
      : null,
    event: event
      ? {
          id: event.id,
          title: event.title,
          slug: event.slug ?? null,
        }
      : null,
  };
}

@ApiTags('admin')
@Controller('admin/refund-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminRefundRequestsController {
  constructor(private readonly refundRequestsService: RefundRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List buyer refund requests for admin review' })
  async list(
    @Query('status') status?: RefundRequestStatus,
    @Query('search') search?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(limitRaw ?? '20', 10) || 20),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);

    const { requests, total } = await this.refundRequestsService.listForAdmin({
      status,
      search,
      limit,
      offset,
    });

    return {
      total,
      limit,
      offset,
      refundRequests: requests.map((request) =>
        serializeRefundRequestRow(request),
      ),
    };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a pending refund request and refund the order',
  })
  @ApiParam({ name: 'id' })
  async approve(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() body: ReviewRefundRequestDto,
    @Req() req: Request,
  ) {
    const result = await this.refundRequestsService.approve(
      id,
      user.id,
      {
        note: body.note,
        refundMode: body.refundMode,
        amountCents: body.amountCents,
      },
      extractAuditContext(req),
    );

    return {
      message: 'Refund request approved',
      refundRequest: serializeRefundRequestRow(result.request),
      order: {
        id: result.refund.id,
        status: result.refund.status,
        refundAmountCents: result.refund.refundAmountCents,
        retainedCents: result.refund.retainedCents,
        refundMode: result.refund.refundMode,
        currency: result.refund.currency,
      },
    };
  }

  @Patch(':id/deny')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deny a pending refund request' })
  @ApiParam({ name: 'id' })
  async deny(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() body: ReviewRefundRequestDto,
    @Req() req: Request,
  ) {
    const request = await this.refundRequestsService.deny(
      id,
      user.id,
      body.note,
      extractAuditContext(req),
    );

    return {
      message: 'Refund request denied',
      refundRequest: serializeRefundRequestRow(request),
    };
  }
}
