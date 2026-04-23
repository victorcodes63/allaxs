import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentPlan } from './payment-plan.entity';

export enum PaymentInstallmentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

@Entity('payment_installments')
export class PaymentInstallment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  planId!: string;

  @ManyToOne(() => PaymentPlan, (p) => p.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: PaymentPlan;

  @Index(['planId', 'sequence'])
  @Column({ type: 'integer' })
  sequence!: number;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  pct!: number;

  @Index()
  @Column({ type: 'timestamptz' })
  dueAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    default: PaymentInstallmentStatus.PENDING,
  })
  status!: PaymentInstallmentStatus;
}
