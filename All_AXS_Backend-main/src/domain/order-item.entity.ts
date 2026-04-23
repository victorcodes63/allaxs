import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { TicketType } from 'src/events/entities/ticket-type.entity';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({ type: 'uuid' })
  ticketTypeId!: string;

  @ManyToOne(() => TicketType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType!: TicketType;

  @Column({ type: 'integer' })
  qty!: number;

  @Column({ type: 'integer' })
  unitPriceCents!: number;

  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;
}
