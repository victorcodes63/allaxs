import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectEventDto {
  @ApiPropertyOptional({
    description: 'Reason for rejection',
    example: 'Event does not meet our guidelines',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
