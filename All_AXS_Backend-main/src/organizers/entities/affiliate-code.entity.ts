import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { OrganizerProfile } from '../../users/entities/organizer-profile.entity';
import { Event } from '../../events/entities/event.entity';
import { AffiliateConversion } from './affiliate-conversion.entity';

/**
 * Affiliate / referral code minted by an organizer. Can be org-wide
 * (`eventId === null`) or restricted to a single event. Commission is
 * stored as a 0–100 percent applied to the gross order amount when the
 * conversion is recorded.
 */
@Entity('affiliate_codes')
@Index('UQ_affiliate_codes_org_code', ['organizerProfileId', 'code'], {
  unique: true,
})
export class AffiliateCode extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'organizer_profile_id' })
  organizerProfileId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_profile_id' })
  organizerProfile!: OrganizerProfile;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'event_id' })
  eventId?: string | null;

  @ManyToOne(() => Event, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event?: Event | null;

  @Column({ type: 'varchar', length: 80 })
  code!: string;

  /** Stored as numeric(5,2). Range enforced 0..100 in the migration. */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'commission_percent',
    transformer: {
      to: (value: number | null | undefined): number => Number(value ?? 0),
      from: (value: string | number | null): number =>
        value === null || value === undefined ? 0 : Number(value),
    },
  })
  commissionPercent!: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @OneToMany(() => AffiliateConversion, (c) => c.affiliateCode)
  conversions!: AffiliateConversion[];
}
