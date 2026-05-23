import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundRequest } from '../domain/refund-request.entity';
import { Order } from '../domain/order.entity';
import { OrderStatus, RefundRequestStatus } from '../domain/enums';
import { OrderRefundService } from './order-refund.service';
import { AdminAuditService } from './admin-audit.service';

export interface RefundRequestListFilters {
  status?: RefundRequestStatus;
  search?: string;
  limit: number;
  offset: number;
}

export interface RefundRequestAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class RefundRequestsService {
  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderRefundService: OrderRefundService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  async createRequest(
    orderId: string,
    userId: string,
    email: string,
    reason: string,
    audit?: RefundRequestAuditContext,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Only paid orders are eligible for a refund request',
      );
    }

    const existing = await this.refundRequestRepository.findOne({
      where: { orderId },
    });
    if (existing) {
      if (existing.status === RefundRequestStatus.PENDING) {
        throw new BadRequestException(
          'A refund request is already pending for this order',
        );
      }
      throw new BadRequestException(
        'A refund request already exists for this order',
      );
    }

    const request = this.refundRequestRepository.create({
      orderId,
      userId,
      email: email.trim().toLowerCase(),
      reason: reason.trim(),
      status: RefundRequestStatus.PENDING,
    });
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId: userId,
      action: 'REFUND_REQUEST_CREATED',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId,
        userId,
        email: saved.email,
        reason: saved.reason,
      },
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });

    return saved;
  }

  async getForBuyer(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const request = await this.refundRequestRepository.findOne({
      where: { orderId },
    });
    return request;
  }

  async listForBuyer(userId: string) {
    const requests = await this.refundRequestRepository.find({
      where: { userId },
      relations: ['order', 'order.event'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      id: request.id,
      orderId: request.orderId,
      email: request.email,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt ?? null,
      adminNote: request.adminNote ?? null,
      eventTitle: request.order?.event?.title ?? null,
      eventSlug: request.order?.event?.slug ?? null,
    }));
  }

  async listForAdmin(filters: RefundRequestListFilters) {
    const qb = this.refundRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.order', 'order')
      .leftJoinAndSelect('order.event', 'event')
      .orderBy('request.createdAt', 'DESC');

    if (filters.status) {
      qb.andWhere('request.status = :status', { status: filters.status });
    }

    const search = filters.search?.trim();
    if (search) {
      qb.andWhere(
        '(request.email ILIKE :search OR order.reference ILIKE :search OR CAST(order.id AS text) ILIKE :search OR CAST(request.id AS text) ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const requests = await qb
      .skip(filters.offset)
      .take(filters.limit)
      .getMany();

    return { requests, total };
  }

  async approve(
    id: string,
    adminUserId: string,
    options?: {
      note?: string;
      refundMode?: string;
      amountCents?: number;
    },
    audit?: RefundRequestAuditContext,
  ) {
    const request = await this.refundRequestRepository.findOne({
      where: { id },
      relations: ['order'],
    });
    if (!request) {
      throw new NotFoundException('Refund request not found');
    }
    if (request.status !== RefundRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending refund requests can be approved',
      );
    }

    const refundReason = [
      `Buyer request: ${request.reason}`,
      options?.note?.trim() ? `Admin note: ${options.note.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const refundResult = await this.orderRefundService.refundPaidOrder(
      request.orderId,
      {
        reason: refundReason,
        refundMode: options?.refundMode,
        amountCents: options?.amountCents,
      },
    );

    request.status = RefundRequestStatus.APPROVED;
    request.reviewedAt = new Date();
    request.reviewedByUserId = adminUserId;
    request.adminNote = options?.note?.trim() || null;
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId,
      action: 'APPROVED',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId: saved.orderId,
        buyerReason: request.reason,
        adminNote: saved.adminNote,
        refundAmountCents: refundResult.order.refundAmountCents,
        retainedCents: refundResult.order.retainedCents,
        refundMode: refundResult.order.refundMode,
        currency: refundResult.order.currency,
      },
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });

    const hydrated = await this.refundRequestRepository.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.event'],
    });

    return { request: hydrated ?? saved, refund: refundResult.order };
  }

  async deny(
    id: string,
    adminUserId: string,
    note?: string,
    audit?: RefundRequestAuditContext,
  ) {
    const request = await this.refundRequestRepository.findOne({
      where: { id },
      relations: ['order'],
    });
    if (!request) {
      throw new NotFoundException('Refund request not found');
    }
    if (request.status !== RefundRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending refund requests can be denied',
      );
    }
    if (request.order?.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Refund request cannot be denied because the order is no longer paid',
      );
    }

    request.status = RefundRequestStatus.DENIED;
    request.reviewedAt = new Date();
    request.reviewedByUserId = adminUserId;
    request.adminNote = note?.trim() || null;
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId,
      action: 'DENIED',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId: saved.orderId,
        buyerReason: request.reason,
        adminNote: saved.adminNote,
      },
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });

    const hydrated = await this.refundRequestRepository.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.event'],
    });

    return hydrated ?? saved;
  }
}
