import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { PaymentGateway, PaymentStatus } from './enums';

@Entity('payments')
export class Payment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'enum', enum: PaymentGateway })
  gateway!: PaymentGateway;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  intentId!: string;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus })
  status!: PaymentStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  txRef?: string;

  @Column({ type: 'integer' })
  amountCents!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: Record<string, any>;
}
