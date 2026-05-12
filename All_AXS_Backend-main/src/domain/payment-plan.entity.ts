import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { TicketType } from 'src/events/entities/ticket-type.entity';
import { PaymentInstallment } from './payment-installment.entity';

export enum PaymentPlanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DEFAULTED = 'DEFAULTED',
  CANCELLED = 'CANCELLED',
}

@Entity('payment_plans')
export class PaymentPlan extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.paymentPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({ type: 'uuid', name: 'ticket_type_id' })
  ticketTypeId!: string;

  @ManyToOne(() => TicketType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType!: TicketType;

  @Column({ type: 'integer' })
  totalAmount!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @Index()
  @Column({ type: 'varchar', length: 32, default: PaymentPlanStatus.ACTIVE })
  status!: PaymentPlanStatus;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  nextDueAt?: Date;

  @Column({ type: 'integer', nullable: true })
  gracePeriodDays?: number;

  @Column({ type: 'boolean', default: false })
  autoCancelOnDefault!: boolean;

  @OneToMany(() => PaymentInstallment, (installment) => installment.plan, {
    cascade: true,
  })
  installments!: PaymentInstallment[];
}
