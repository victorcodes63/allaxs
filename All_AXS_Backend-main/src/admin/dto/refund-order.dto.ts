import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { RefundMode } from '../../domain/refund-policy';

export class RefundOrderDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional({
    enum: ['POLICY', 'FULL', 'CUSTOM'],
    description:
      'POLICY = 75% per platform refund policy; FULL = 100%; CUSTOM = explicit amountCents',
    default: 'POLICY',
  })
  @IsOptional()
  @IsIn(['POLICY', 'FULL', 'CUSTOM'])
  refundMode?: RefundMode;

  @ApiPropertyOptional({
    description: 'Required when refundMode is CUSTOM (minor units, e.g. cents)',
  })
  @ValidateIf((o: RefundOrderDto) => o.refundMode === 'CUSTOM')
  @IsInt()
  @Min(1)
  amountCents?: number;
}
