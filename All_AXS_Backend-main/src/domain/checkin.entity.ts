import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Ticket } from './ticket.entity';
import { User } from 'src/users/entities/user.entity';
import { ScannerSession } from 'src/scanner/entities/scanner-session.entity';

@Entity('checkins')
export class CheckIn extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'ticket_id' })
  ticketId!: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: Ticket;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'operator_id' })
  operatorId?: string | null;

  @ManyToOne(() => User, (u) => u.checkIns, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: User | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gateId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceId?: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Index()
  @Column({ type: 'uuid', name: 'scanner_session_id', nullable: true })
  scannerSessionId?: string | null;

  @ManyToOne(() => ScannerSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scanner_session_id' })
  scannerSession?: ScannerSession | null;
}
