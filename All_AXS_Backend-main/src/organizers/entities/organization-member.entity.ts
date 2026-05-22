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
  Unique,
} from 'typeorm';

@Entity('organization_members')
@Unique('UQ_org_member_profile_user', ['organizerProfileId', 'userId'])
export class OrganizationMember extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'organizer_profile_id' })
  organizerProfileId!: string;

  @ManyToOne(() => OrganizerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_profile_id' })
  organizerProfile!: OrganizerProfile;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: OrgMemberRole,
    enumName: 'org_member_role_enum',
  })
  role!: OrgMemberRole;
}
