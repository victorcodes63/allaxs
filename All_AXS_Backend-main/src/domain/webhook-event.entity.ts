import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('webhook_events')
export class WebhookEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  source!: string; // e.g., 'paystack'

  @Index()
  @Column({ type: 'varchar', length: 180 })
  externalId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 180, unique: true })
  idempotencyKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;
}
