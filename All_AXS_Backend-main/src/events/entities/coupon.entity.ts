import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Event } from './event.entity';
import { BaseEntity } from 'src/domain/base.entity';
import { CouponType } from 'src/domain/enums';

@Entity('coupons')
export class Coupon extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: CouponType })
  kind!: CouponType;

  @Column({ type: 'integer', nullable: true })
  valueCents?: number;

  @Column({ type: 'integer', nullable: true })
  percentOff?: number;

  @Column({ type: 'timestamptz', nullable: true })
  startAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endAt?: Date;

  @Column({ type: 'integer', nullable: true })
  usageLimit?: number;

  @Column({ type: 'integer', default: 0 })
  usedCount!: number;

  @Column({ type: 'integer', nullable: true })
  perUserLimit?: number;

  /**
   * Optional subtotal floor (in minor units). Orders below this amount
   * cannot redeem the coupon. See COUPONS_SPEC §3 rule 7.
   */
  @Column({ type: 'integer', nullable: true, name: 'min_order_cents' })
  minOrderCents?: number;

  /**
   * Optional ISO 4217 currency restriction. When `NULL`, the coupon
   * applies to any order currency. When set, only orders in this
   * currency may redeem (see COUPONS_SPEC §3 rule 4).
   */
  @Column({ type: 'char', length: 3, nullable: true })
  currency?: string;

  @Index()
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => Event, (e) => e.coupons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
