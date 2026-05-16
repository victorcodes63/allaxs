import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export type ScanTicketActionDto = 'VERIFY' | 'CHECK_IN';

export class ScanTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20000)
  payload!: string;

  @IsIn(['VERIFY', 'CHECK_IN'])
  action!: ScanTicketActionDto;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
