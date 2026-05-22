import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateQrDto {
  @ApiProperty({
    description: 'Raw string decoded from the QR code (format: "<ticketId>:<qrNonce>")',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  qrPayload!: string;
}
