import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderStatus } from './enums';
import { User } from 'src/users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';
import { Ticket } from './ticket.entity';
import { Event } from 'src/events/entities/event.entity';
import { PaymentPlan } from './payment-plan.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Index()
  @Column({ type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => Event, (e) => e.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status!: OrderStatus;

  @Column({ type: 'integer' })
  amountCents!: number;

  @Column({ type: 'integer', default: 0 })
  feesCents!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  reference?: string;

  @Index()
  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => OrderItem, (i) => i.order)
  items!: OrderItem[];

  @OneToMany(() => Payment, (p) => p.order)
  payments!: Payment[];

  @OneToMany(() => Ticket, (t) => t.order)
  tickets!: Ticket[];

  @OneToMany(() => PaymentPlan, (p) => p.order)
  paymentPlans!: PaymentPlan[];
}
