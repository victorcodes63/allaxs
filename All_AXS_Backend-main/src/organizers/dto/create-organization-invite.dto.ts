import { IsEmail, IsEnum } from 'class-validator';
import { OrgMemberRole } from 'src/domain/org-member-role.enum';

export class CreateOrganizationInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgMemberRole)
  role!: OrgMemberRole;
}
