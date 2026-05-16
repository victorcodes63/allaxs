import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PayoutBatchStatus } from './enums';
import { PayoutBatchLine } from './payout-batch-line.entity';

@Entity('payout_batches')
export class PayoutBatch extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PayoutBatchStatus,
    enumName: 'payout_batch_status_enum',
    default: PayoutBatchStatus.DRAFT,
  })
  status!: PayoutBatchStatus;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'external_reference',
  })
  externalReference?: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by_user_id' })
  createdByUserId?: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_at' })
  approvedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'marked_paid_at' })
  markedPaidAt?: Date | null;

  @OneToMany(() => PayoutBatchLine, (l) => l.batch)
  lines!: PayoutBatchLine[];
}
