import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from 'src/domain/enums';

export class UpdateOrganizerTicketDto {
  @ApiProperty({ enum: TicketStatus, description: 'Target ticket status' })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
