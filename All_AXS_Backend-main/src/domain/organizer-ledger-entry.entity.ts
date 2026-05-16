import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { LedgerEntryType } from './enums';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Order } from './order.entity';

@Entity('organizer_ledger_entries')
export class OrganizerLedgerEntry extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'organizer_id' })
  organizerId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_id' })
  organizer!: OrganizerProfile;

  @Column({ type: 'uuid', nullable: true, name: 'order_id' })
  orderId?: string | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  @Column({
    type: 'enum',
    enum: LedgerEntryType,
    enumName: 'ledger_entry_type_enum',
    name: 'entry_type',
  })
  entryType!: LedgerEntryType;

  @Column({ type: 'integer', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' })
  idempotencyKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
