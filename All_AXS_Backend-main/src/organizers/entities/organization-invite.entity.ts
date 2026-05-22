import { BaseEntity } from 'src/domain/base.entity';
import { OrgMemberRole } from 'src/domain/org-member-role.enum';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

@Entity('organization_invites')
export class OrganizationInvite extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'organizer_profile_id' })
  organizerProfileId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_profile_id' })
  organizerProfile!: OrganizerProfile;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    type: 'enum',
    enum: OrgMemberRole,
    enumName: 'org_member_role_enum',
  })
  role!: OrgMemberRole;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'uuid', name: 'invited_by_user_id' })
  invitedByUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedByUser!: User;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt?: Date | null;

  @Column({ type: 'uuid', name: 'accepted_by_user_id', nullable: true })
  acceptedByUserId?: string | null;
}
