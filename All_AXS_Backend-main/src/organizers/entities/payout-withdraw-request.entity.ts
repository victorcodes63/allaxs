import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { PayoutWithdrawRequestStatus } from '../../domain/enums';
import { OrganizerProfile } from '../../users/entities/organizer-profile.entity';

/**
 * Self-serve withdrawal request from an organizer.
 *
 * Sits in front of the admin payout-batch workflow: the organizer asks
 * to be paid out an amount they have available, an admin reviews it,
 * and once a batch covering it is marked paid the request flips to PAID.
 *
 * `amountCents` is captured at request time (not recomputed) so we have
 * an auditable record of what the organizer asked for, even if their
 * ledger balance shifts before admin action.
 */
@Entity('payout_withdraw_requests')
@Index('IDX_payout_withdraw_requests_organizer_status', [
  'organizerProfileId',
  'status',
])
export class PayoutWithdrawRequest extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'organizer_profile_id' })
  organizerProfileId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_profile_id' })
  organizerProfile!: OrganizerProfile;

  @Column({ type: 'integer', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: PayoutWithdrawRequestStatus,
    enumName: 'payout_withdraw_request_status_enum',
    default: PayoutWithdrawRequestStatus.PENDING,
  })
  status!: PayoutWithdrawRequestStatus;

  /**
   * When the organizer submitted the request. Mirrors createdAt today
   * but kept as an independent column so we can backfill historic
   * requests later without losing the original submission timestamp.
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'requested_at' })
  requestedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
  processedAt?: Date | null;

  @Column({ type: 'text', nullable: true, name: 'admin_note' })
  adminNote?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
