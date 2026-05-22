import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { RefundRequestStatus } from './enums';
import { Order } from './order.entity';
import { User } from '../users/entities/user.entity';

@Entity('refund_requests')
export class RefundRequest extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Index()
  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: RefundRequestStatus,
    default: RefundRequestStatus.PENDING,
  })
  status!: RefundRequestStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by_user_id' })
  reviewedByUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedByUser?: User | null;

  @Column({ type: 'text', nullable: true, name: 'admin_note' })
  adminNote?: string | null;
}
