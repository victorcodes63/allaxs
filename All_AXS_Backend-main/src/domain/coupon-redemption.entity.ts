import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { Coupon } from 'src/events/entities/coupon.entity';
import { User } from 'src/users/entities/user.entity';

/**
 * One row per successful coupon redemption. Enforces the
 * "one coupon per order" decision via the unique constraint on `orderId`,
 * and powers the per-user cap lookup via the composite indexes on
 * `(couponId, userId)` and `(couponId, email)`.
 *
 * See `All_AXS_Web-main/docs/COUPONS_SPEC.md` §2.2.2.
 */
@Entity('coupon_redemptions')
@Index('IDX_coupon_redemptions_coupon_user', ['couponId', 'userId'])
@Index('IDX_coupon_redemptions_coupon_email', ['couponId', 'email'])
export class CouponRedemption extends BaseEntity {
  @Column({ type: 'uuid', name: 'coupon_id' })
  couponId!: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coupon_id' })
  coupon!: Coupon;

  @Column({ type: 'uuid', name: 'order_id', unique: true })
  orderId!: string;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  /**
   * Logged-in buyer at redemption time. Null for guest checkout, in which
   * case `email` is the cap-enforcement key.
   */
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  /**
   * Normalised buyer email at the moment of redemption. `citext` so
   * per-user cap checks against guest emails are case-insensitive
   * without bespoke index expressions.
   */
  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'integer', name: 'discount_cents' })
  discountCents!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;
}
