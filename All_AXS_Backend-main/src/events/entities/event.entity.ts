import { BaseEntity } from 'src/domain/base.entity';
import { EventStatus, EventType } from 'src/domain/enums';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  AfterLoad,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Coupon } from './coupon.entity';
import { Order } from 'src/domain/order.entity';
import { TicketType } from './ticket-type.entity';

@Entity('events')
export class Event extends BaseEntity {
  @ManyToOne(() => OrganizerProfile, (o) => o.events, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'organizer_id' })
  @Index()
  organizer!: OrganizerProfile;

  // Expose organizerId as a property for serialization
  organizerId!: string;

  @AfterLoad()
  setOrganizerId() {
    if (this.organizer && this.organizer.id) {
      this.organizerId = this.organizer.id;
    }
  }

  @ApiProperty({ description: 'Event title', maxLength: 180 })
  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @ApiProperty({ description: 'Unique event slug' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiPropertyOptional({ description: 'Banner image URL', nullable: true })
  @Column({ type: 'text', nullable: true })
  bannerUrl: string | null;

  @ApiPropertyOptional({ description: 'Event venue' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  venue?: string;

  @ApiPropertyOptional({ description: 'Event city' })
  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string;

  @ApiPropertyOptional({ description: 'Event country' })
  @Column({ type: 'varchar', length: 120, nullable: true })
  country?: string;

  @ApiProperty({ description: 'Event start date/time' })
  @Index()
  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @ApiProperty({ description: 'Event end date/time' })
  @Column({ type: 'timestamptz' })
  endAt!: Date;

  @ApiProperty({ enum: EventType, description: 'Event type' })
  @Column({ type: 'enum', enum: EventType })
  type!: EventType;

  @ApiProperty({
    enum: EventStatus,
    description: 'Event status',
    default: EventStatus.DRAFT,
  })
  @Index()
  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status!: EventStatus;

  @ApiPropertyOptional({ description: 'Event category' })
  @Column({ type: 'varchar', length: 120, nullable: true })
  category?: string;

  @ApiProperty({ description: 'Whether event is public', default: true })
  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata (JSON)',
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => TicketType, (t) => t.event)
  ticketTypes!: TicketType[];

  @OneToMany(() => Coupon, (c) => c.event)
  coupons!: Coupon[];

  @OneToMany(() => Order, (o) => o.event)
  orders!: Order[];
}
