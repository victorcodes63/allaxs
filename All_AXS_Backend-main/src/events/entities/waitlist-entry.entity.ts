import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { WaitlistStatus } from '../../domain/enums';
import { Event } from './event.entity';
import { TicketType } from './ticket-type.entity';
import { User } from '../../users/entities/user.entity';

@Entity('waitlist_entries')
@Index('IDX_waitlist_entries_tier_status_position', [
  'tierId',
  'status',
  'position',
])
@Index('IDX_waitlist_entries_tier_email_active', ['tierId', 'email'], {
  unique: true,
  where: `"status" IN ('WAITING', 'NOTIFIED')`,
})
export class WaitlistEntry extends BaseEntity {
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @Column({ type: 'uuid', name: 'tier_id' })
  tierId!: string;

  @ManyToOne(() => TicketType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tier_id' })
  tier!: TicketType;

  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'integer' })
  position!: number;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.WAITING,
  })
  status!: WaitlistStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'notified_at' })
  notifiedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'offer_expires_at' })
  offerExpiresAt?: Date | null;
}
