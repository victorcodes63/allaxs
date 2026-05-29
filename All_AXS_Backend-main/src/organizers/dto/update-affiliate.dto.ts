import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateAffiliateDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'DISABLED'])
  status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
}
