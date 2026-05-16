import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { PayoutBatch } from './payout-batch.entity';

@Entity('payout_batch_lines')
export class PayoutBatchLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'batch_id' })
  batchId!: string;

  @ManyToOne(() => PayoutBatch, (b) => b.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch!: PayoutBatch;

  @Index()
  @Column({ type: 'uuid', name: 'organizer_id' })
  organizerId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_id' })
  organizer!: OrganizerProfile;

  @Column({ type: 'integer', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;
}
