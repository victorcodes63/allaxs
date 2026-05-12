import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/domain/base.entity';
import { Event } from './event.entity';
import { TicketTypeStatus } from 'src/domain/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('ticket_types')
export class TicketType extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => Event, (e) => e.ticketTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @ApiProperty({ description: 'Ticket type name', maxLength: 120 })
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @ApiPropertyOptional({ description: 'Ticket type description' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Price in cents' })
  @Column({ type: 'integer' })
  priceCents!: number;

  @ApiProperty({ description: 'Currency code', default: 'KES' })
  @Column({ type: 'char', length: 3, default: 'KES' })
  currency!: string;

  @ApiProperty({ description: 'Total quantity available' })
  @Column({ type: 'integer' })
  quantityTotal!: number;

  @ApiProperty({ description: 'Quantity sold', default: 0 })
  @Column({ type: 'integer', default: 0 })
  quantitySold!: number;

  @ApiProperty({ description: 'Minimum per order', default: 1 })
  @Column({ type: 'integer', default: 1 })
  minPerOrder!: number;

  @ApiPropertyOptional({ description: 'Maximum per order' })
  @Column({ type: 'integer', nullable: true })
  maxPerOrder?: number;

  @ApiPropertyOptional({ description: 'Sales start date/time' })
  @Column({ type: 'timestamptz', nullable: true })
  salesStart?: Date;

  @ApiPropertyOptional({ description: 'Sales end date/time' })
  @Column({ type: 'timestamptz', nullable: true })
  salesEnd?: Date;

  @ApiProperty({
    enum: TicketTypeStatus,
    description: 'Ticket type status',
    default: TicketTypeStatus.ACTIVE,
  })
  @Index()
  @Column({
    type: 'enum',
    enum: TicketTypeStatus,
    default: TicketTypeStatus.ACTIVE,
    name: 'status',
  })
  status!: TicketTypeStatus;

  @ApiPropertyOptional({
    description: 'Allow payment in installments',
    default: false,
  })
  @Column({ type: 'boolean', default: false, name: 'allow_installments' })
  allowInstallments!: boolean;

  @ApiPropertyOptional({
    description: 'Installment configuration (JSON)',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true, name: 'installment_config' })
  installmentConfig?: {
    mode: 'PERCENT_SPLITS';
    splits: Array<{
      seq: number;
      pct: number;
      dueAfterDays: number;
    }>;
    minDepositPct?: number;
    gracePeriodDays?: number;
    autoCancelOnDefault?: boolean;
  } | null;
}
