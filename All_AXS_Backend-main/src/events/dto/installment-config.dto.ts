import {
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstallmentSplitDto {
  @ApiProperty({
    description: 'Sequence number (1-based, must be strictly increasing)',
  })
  @IsNumber()
  @Min(1)
  seq!: number;

  @ApiProperty({ description: 'Percentage of total (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  pct!: number;

  @ApiProperty({
    description: 'Days after order creation when this installment is due',
  })
  @IsNumber()
  @Min(0)
  dueAfterDays!: number;
}

export class InstallmentConfigDto {
  @ApiProperty({ enum: ['PERCENT_SPLITS'], description: 'Installment mode' })
  @IsEnum(['PERCENT_SPLITS'])
  mode!: 'PERCENT_SPLITS';

  @ApiProperty({
    type: [InstallmentSplitDto],
    description: 'Payment splits',
    minItems: 2,
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 splits are required' })
  @ValidateNested({ each: true })
  @Type(() => InstallmentSplitDto)
  splits!: InstallmentSplitDto[];

  @ApiPropertyOptional({
    description: 'Minimum deposit percentage (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minDepositPct?: number;

  @ApiPropertyOptional({
    description: 'Grace period in days before marking as overdue',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @ApiPropertyOptional({
    description: 'Automatically cancel order on default',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoCancelOnDefault?: boolean;
}
