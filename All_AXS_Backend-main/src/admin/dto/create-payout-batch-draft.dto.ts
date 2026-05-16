import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CreatePayoutBatchDraftDto {
  @ApiProperty({
    type: [String],
    description: 'Organizer profile IDs to include (one line per organizer with available balance)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  organizerIds!: string[];
}
