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

export class ReviewRefundRequestDto {
  @ApiPropertyOptional({
    description: 'Optional admin note recorded on the refund request',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    enum: ['POLICY', 'FULL', 'CUSTOM'],
    description:
      'How much to refund when approving. Defaults to POLICY (75%).',
    default: 'POLICY',
  })
  @IsOptional()
  @IsIn(['POLICY', 'FULL', 'CUSTOM'])
  refundMode?: RefundMode;

  @ApiPropertyOptional({
    description: 'Required when refundMode is CUSTOM (minor units)',
  })
  @ValidateIf((o: ReviewRefundRequestDto) => o.refundMode === 'CUSTOM')
  @IsInt()
  @Min(1)
  amountCents?: number;
}
