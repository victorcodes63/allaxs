import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAffiliateDto {
  @ApiProperty({ example: 'PARTNER10' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @ApiPropertyOptional({ example: 'Influencer campaign' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @ApiPropertyOptional({ description: 'Restrict code to a single event' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ example: 10, description: 'Commission percent 0–100' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}
