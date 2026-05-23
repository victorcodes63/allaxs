import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransferTicketDto {
  @IsEmail()
  recipientEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string;
}
