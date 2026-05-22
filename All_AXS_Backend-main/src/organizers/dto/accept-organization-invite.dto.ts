import { IsString, MinLength } from 'class-validator';

export class AcceptOrganizationInviteDto {
  @IsString()
  @MinLength(32)
  token!: string;
}
