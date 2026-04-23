import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Order } from '../order.entity';
import { PaymentProgress } from '../payment-progress.helper';

export interface PaymentSummary {
  mode: 'FULL' | 'INSTALLMENTS';
  plan?: {
    paidCount: number;
    count: number;
    nextDueAt?: Date;
    completed: boolean;
    total: number;
    paid: number;
  };
}

export class OrderWithPaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiProperty()
  eventId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  amountCents!: number;

  @ApiProperty()
  feesCents!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  reference?: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional({ type: Object })
  paymentSummary?: PaymentSummary;

  static fromOrder(
    order: Order,
    progress: PaymentProgress | null,
  ): OrderWithPaymentDto {
    const dto = new OrderWithPaymentDto();
    dto.id = order.id;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    dto.userId = order.userId;
    dto.eventId = order.eventId;
    dto.status = order.status;
    dto.amountCents = order.amountCents;
    dto.feesCents = order.feesCents;
    dto.currency = order.currency;
    dto.reference = order.reference;
    dto.email = order.email;
    dto.phone = order.phone;
    dto.notes = order.notes;

    if (progress) {
      dto.paymentSummary = {
        mode: 'INSTALLMENTS',
        plan: {
          paidCount: progress.paidCount,
          count: progress.count,
          nextDueAt: progress.nextDueAt,
          completed: progress.completed,
          total: progress.total,
          paid: progress.paid,
        },
      };
    } else {
      dto.paymentSummary = {
        mode: 'FULL',
      };
    }

    return dto;
  }
}
