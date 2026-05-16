import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderStatus } from './enums';
import { User } from 'src/users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';
import { Ticket } from './ticket.entity';
import { Event } from 'src/events/entities/event.entity';
import { Coupon } from 'src/events/entities/coupon.entity';
import { PaymentPlan } from './payment-plan.entity';
import { CouponRedemption } from './coupon-redemption.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string | null;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Index()
  @Column({ type: 'uuid', name: 'event_id' })
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

  /**
   * Discount in minor units applied at order creation time, locked for
   * the lifetime of the order. `amountCents` is already net of this
   * value (buyer-paid total); gross = `amountCents + discountCents`.
   * See `All_AXS_Web-main/docs/COUPONS_SPEC.md` §4.
   */
  @Column({ type: 'integer', default: 0, name: 'discount_cents' })
  discountCents!: number;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'applied_coupon_id' })
  appliedCouponId?: string | null;

  @ManyToOne(() => Coupon, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'applied_coupon_id' })
  appliedCoupon?: Coupon | null;

  @OneToOne(() => CouponRedemption, (r) => r.order)
  couponRedemption?: CouponRedemption;

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
