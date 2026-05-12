import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Ticket } from './ticket.entity';
import { User } from 'src/users/entities/user.entity';

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
}
