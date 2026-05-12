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
  valueCents?: number; // for FIXED

  @Column({ type: 'integer', nullable: true })
  percentOff?: number; // 0..100 for PERCENT

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

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'event_id' })
  eventId?: string | null;

  @ManyToOne(() => Event, (e) => e.coupons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: Event | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
