import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScannerSessionDto {
  @ApiProperty({ description: 'Human-readable label, e.g. "Main Door"', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ description: 'Session expiry as ISO 8601 datetime string' })
  @IsDateString()
  expiresAt!: string;

  @ApiPropertyOptional({ description: 'Optional zone scope for future per-zone filtering', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  zoneScope?: string;

  @ApiPropertyOptional({ description: 'Email address of volunteer to send an invite to', maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  volunteerEmail?: string;
}
