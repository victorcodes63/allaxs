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
import { OrderRefundService } from '../admin/order-refund.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import { ReviewOrganizerRefundDto } from './dto/review-organizer-refund.dto';
import { InitiateOrganizerRefundDto } from './dto/initiate-organizer-refund.dto';
import { OrganizerScopeService } from './organizer-scope.service';

export type OrganizerRefundRow = {
  id: string;
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  eventTitle: string;
  amountCents: number;
  currency: string;
  reason: string | null;
  status:
    | 'REQUESTED'
    | 'APPROVED'
    | 'DENIED'
    | 'PROCESSING'
    | 'REFUNDED'
    | 'FAILED';
  createdAt: string;
  updatedAt: string;
  decisionNote: string | null;
};

function parseBuyerNameFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  try {
    const meta = JSON.parse(notes) as { buyerName?: string };
    return (meta.buyerName ?? '').trim();
  } catch {
    return '';
  }
}

@Injectable()
export class OrganizerRefundsService {
  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderRefundService: OrderRefundService,
    private readonly adminAuditService: AdminAuditService,
    private readonly scopeService: OrganizerScopeService,
  ) {}

  private mapDisplayStatus(
    request: RefundRequest,
    order?: Order | null,
  ): OrganizerRefundRow['status'] {
    if (request.status === RefundRequestStatus.DENIED) return 'DENIED';
    if (order?.status === OrderStatus.REFUNDED) return 'REFUNDED';
    if (request.status === RefundRequestStatus.APPROVED) return 'APPROVED';
    return 'REQUESTED';
  }

  private serialize(request: RefundRequest): OrganizerRefundRow {
    const order = request.order;
    return {
      id: request.id,
      orderId: request.orderId,
      buyerEmail: request.email,
      buyerName: parseBuyerNameFromNotes(order?.notes),
      eventTitle: order?.event?.title ?? 'Event',
      amountCents: order?.amountCents ?? 0,
      currency: order?.currency ?? 'KES',
      reason: request.reason ?? null,
      status: this.mapDisplayStatus(request, order),
      createdAt: request.createdAt.toISOString(),
      updatedAt: (request.updatedAt ?? request.createdAt).toISOString(),
      decisionNote: request.adminNote ?? null,
    };
  }

  private mapIncomingStatus(
    status?: string,
  ): RefundRequestStatus | 'REFUNDED' | undefined {
    switch (status?.toUpperCase()) {
      case 'REQUESTED':
        return RefundRequestStatus.PENDING;
      case 'APPROVED':
        return RefundRequestStatus.APPROVED;
      case 'DENIED':
        return RefundRequestStatus.DENIED;
      case 'REFUNDED':
        return 'REFUNDED';
      default:
        return undefined;
    }
  }

  async listForUser(
    userId: string,
    statusFilter?: string,
  ): Promise<OrganizerRefundRow[]> {
    await this.scopeService.getProfileOrThrow(userId);
    const eventIds = await this.scopeService.getOwnedEventIds(userId);
    if (eventIds.length === 0) return [];

    const qb = this.refundRequestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.order', 'order')
      .leftJoinAndSelect('order.event', 'event')
      .where('order.event_id IN (:...eventIds)', { eventIds })
      .orderBy('request.createdAt', 'DESC');

    const mapped = this.mapIncomingStatus(statusFilter);
    if (mapped === RefundRequestStatus.PENDING) {
      qb.andWhere('request.status = :status', {
        status: RefundRequestStatus.PENDING,
      });
    } else if (mapped === RefundRequestStatus.APPROVED) {
      qb.andWhere('request.status = :status', {
        status: RefundRequestStatus.APPROVED,
      }).andWhere('order.status = :orderStatus', {
        orderStatus: OrderStatus.PAID,
      });
    } else if (mapped === 'REFUNDED') {
      qb.andWhere('request.status = :status', {
        status: RefundRequestStatus.APPROVED,
      }).andWhere('order.status = :orderStatus', {
        orderStatus: OrderStatus.REFUNDED,
      });
    } else if (mapped === RefundRequestStatus.DENIED) {
      qb.andWhere('request.status = :status', {
        status: RefundRequestStatus.DENIED,
      });
    }

    const requests = await qb.getMany();
    return requests.map((r) => this.serialize(r));
  }

  private async getOwnedRequestOrThrow(
    userId: string,
    requestId: string,
  ): Promise<RefundRequest> {
    const eventIds = await this.scopeService.getOwnedEventIds(userId);
    const request = await this.refundRequestRepository.findOne({
      where: { id: requestId },
      relations: ['order', 'order.event'],
    });
    if (!request || !eventIds.includes(request.order?.eventId ?? '')) {
      throw new NotFoundException('Refund request not found');
    }
    return request;
  }

  async approveForUser(
    userId: string,
    requestId: string,
    dto: ReviewOrganizerRefundDto,
  ) {
    const request = await this.getOwnedRequestOrThrow(userId, requestId);
    if (request.status !== RefundRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending refund requests can be approved',
      );
    }

    const refundReason = [
      `Buyer request: ${request.reason}`,
      dto.note?.trim() ? `Organizer note: ${dto.note.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const refundResult = await this.orderRefundService.refundPaidOrder(
      request.orderId,
      { reason: refundReason },
    );

    request.status = RefundRequestStatus.APPROVED;
    request.reviewedAt = new Date();
    request.reviewedByUserId = userId;
    request.adminNote = dto.note?.trim() || null;
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId: userId,
      action: 'ORGANIZER_APPROVED_REFUND',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId: saved.orderId,
        buyerReason: request.reason,
        organizerNote: saved.adminNote,
        refundAmountCents: refundResult.order.refundAmountCents,
      },
      ipAddress: null,
      userAgent: null,
    });

    const hydrated = await this.refundRequestRepository.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.event'],
    });
    return this.serialize(hydrated ?? saved);
  }

  async denyForUser(
    userId: string,
    requestId: string,
    dto: ReviewOrganizerRefundDto,
  ) {
    const request = await this.getOwnedRequestOrThrow(userId, requestId);
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
    request.reviewedByUserId = userId;
    request.adminNote = dto.note?.trim() || null;
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId: userId,
      action: 'ORGANIZER_DENIED_REFUND',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId: saved.orderId,
        buyerReason: request.reason,
        organizerNote: saved.adminNote,
      },
      ipAddress: null,
      userAgent: null,
    });

    const hydrated = await this.refundRequestRepository.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.event'],
    });
    return this.serialize(hydrated ?? saved);
  }

  async initiateForUser(userId: string, dto: InitiateOrganizerRefundDto) {
    const eventIds = await this.scopeService.getOwnedEventIds(userId);
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: ['event'],
    });
    if (!order || !eventIds.includes(order.eventId)) {
      throw new NotFoundException('Order not found for your events');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    const reason =
      dto.reason?.trim() || 'Refund initiated by organizer';

    const refundResult = await this.orderRefundService.refundPaidOrder(
      order.id,
      {
        reason,
        amountCents: dto.amountCents,
        refundMode: dto.amountCents ? 'CUSTOM' : 'FULL',
      },
    );

    let request = await this.refundRequestRepository.findOne({
      where: { orderId: order.id },
    });
    if (request) {
      request.status = RefundRequestStatus.APPROVED;
      request.reviewedAt = new Date();
      request.reviewedByUserId = userId;
      request.adminNote = reason;
      request.reason = request.reason || reason;
    } else {
      request = this.refundRequestRepository.create({
        orderId: order.id,
        userId: order.userId ?? null,
        email: order.email,
        reason,
        status: RefundRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
        adminNote: reason,
      });
    }
    const saved = await this.refundRequestRepository.save(request);

    await this.adminAuditService.logAction({
      adminUserId: userId,
      action: 'ORGANIZER_INITIATED_REFUND',
      resourceType: 'refund_request',
      resourceId: saved.id,
      metadata: {
        orderId: order.id,
        refundAmountCents: refundResult.order.refundAmountCents,
        reason,
      },
      ipAddress: null,
      userAgent: null,
    });

    const hydrated = await this.refundRequestRepository.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.event'],
    });
    return this.serialize(hydrated ?? saved);
  }
}
