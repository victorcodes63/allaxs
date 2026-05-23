import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AffiliateCode } from './affiliate-code.entity';
import { Order } from '../../domain/order.entity';

/**
 * Append-only ledger of paid orders attributed to an affiliate code.
 * One row per order (enforced by `UQ_affiliate_conversions_order`).
 */
@Entity('affiliate_conversions')
@Unique('UQ_affiliate_conversions_order', ['orderId'])
export class AffiliateConversion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @Column({ type: 'uuid', name: 'affiliate_code_id' })
  affiliateCodeId!: string;

  @ManyToOne(() => AffiliateCode, (c) => c.conversions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliate_code_id' })
  affiliateCode!: AffiliateCode;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'integer', default: 0, name: 'commission_cents' })
  commissionCents!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;
}
