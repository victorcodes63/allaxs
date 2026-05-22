import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/domain/base.entity';
import { User } from 'src/users/entities/user.entity';
import { Event } from 'src/events/entities/event.entity';

@Entity('scanner_sessions')
export class ScannerSession extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @Column({ type: 'uuid', name: 'created_by_organizer_id' })
  createdByOrganizerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_organizer_id' })
  createdByOrganizer!: User;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120, unique: true })
  token!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 60, name: 'zone_scope', nullable: true })
  zoneScope?: string | null;
}
