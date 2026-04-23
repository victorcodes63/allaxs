import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUrl,
  MinLength,
} from 'class-validator';
import { PayoutMethod } from 'src/domain/enums';

export class CreateOrUpdateOrganizerProfileDto {
  @IsString()
  @MinLength(2)
  orgName!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsEmail()
  supportEmail!: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsEnum(PayoutMethod)
  payoutMethod?: PayoutMethod;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  mpesaPaybill?: string;

  @IsOptional()
  @IsString()
  mpesaTillNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  payoutInstructions?: string;
}
