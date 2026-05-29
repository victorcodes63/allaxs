import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReassignOrderBuyerDto {
  @IsEmail()
  newEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** When true (default), ticket PDF is emailed to the corrected address after reassignment. */
  @IsOptional()
  @IsBoolean()
  resendTickets?: boolean;
}
