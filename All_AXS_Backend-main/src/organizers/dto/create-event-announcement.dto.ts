import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEventAnnouncementDto {
  @ApiProperty({ description: 'Email subject line', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    description: 'HTML body inserted into the branded email shell',
    maxLength: 50000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  bodyHtml!: string;
}
