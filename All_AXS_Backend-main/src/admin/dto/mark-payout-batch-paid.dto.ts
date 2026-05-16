import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MarkPayoutBatchPaidDto {
  @ApiProperty({
    description: 'Bank or finance reference for this settlement run',
    example: 'FT-2026-0513-001',
  })
  @IsString()
  @MinLength(1)
  externalReference!: string;
}
