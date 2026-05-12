import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { TicketStatus } from './enums';
import { TicketType } from 'src/events/entities/ticket-type.entity';
import { User } from 'src/users/entities/user.entity';

@Entity('tickets')
export class Ticket extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({ type: 'uuid', name: 'ticket_type_id' })
  ticketTypeId!: string;

  @ManyToOne(() => TicketType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType!: TicketType;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'owner_user_id' })
  ownerUserId?: string | null;

  @ManyToOne(() => User, (u) => u.tickets, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser?: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  attendeeName?: string;

  @Column({ type: 'citext', nullable: true })
  attendeeEmail?: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  attendeePhone?: string;

  @Index()
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.ISSUED })
  status!: TicketStatus;

  @Column({ type: 'varchar', length: 120 })
  qrNonce!: string;

  @Column({ type: 'varchar', length: 512 })
  qrSignature!: string;
}
