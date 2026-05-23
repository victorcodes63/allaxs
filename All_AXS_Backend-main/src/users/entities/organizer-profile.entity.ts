import { BaseEntity } from 'src/domain/base.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from 'src/events/entities/event.entity';
import { PayoutMethod } from 'src/domain/enums';

@Entity('organizer_profiles')
export class OrganizerProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', unique: true, name: 'user_id' })
  userId!: string;

  @OneToOne(() => User, (u) => u.organizer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  orgName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'legal_name' })
  legalName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ type: 'varchar', length: 255, name: 'support_email' })
  supportEmail!: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    name: 'support_phone',
  })
  supportPhone?: string;

  @Column({
    type: 'enum',
    enum: PayoutMethod,
    nullable: true,
    name: 'payout_method',
  })
  payoutMethod?: PayoutMethod;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'bank_name' })
  bankName?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'bank_account_name',
  })
  bankAccountName?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'bank_account_number',
  })
  bankAccountNumber?: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    name: 'mpesa_paybill',
  })
  mpesaPaybill?: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    name: 'mpesa_till_number',
  })
  mpesaTillNumber?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tax_id' })
  taxId?: string;

  @Column({ type: 'jsonb', nullable: true })
  payoutDetails?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  // ─── Branded public storefront (`/o/:slug`) ─────────────────────────────
  // `storeSlug` is unique only when set; profiles without a slug remain
  // private until the organizer picks one. The remaining fields populate
  // the marketing surface for the public organizer page.
  @Index({ unique: true, where: '"store_slug" IS NOT NULL' })
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'store_slug' })
  storeSlug?: string | null;

  @Column({ type: 'text', nullable: true })
  bio?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'logo_url' })
  logoUrl?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'brand_color' })
  brandColor?: string | null;

  @Column({ type: 'boolean', default: true, name: 'store_public' })
  storePublic!: boolean;

  @OneToMany(() => Event, (e) => e.organizer)
  events!: Event[];
}
