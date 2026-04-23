import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  MaxLength,
  ValidateIf,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InstallmentConfigDto } from './installment-config.dto';

export class UpdateTicketTypeDto {
  @ApiPropertyOptional({ description: 'Ticket type name', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Name must be at most 120 characters' })
  name?: string;

  @ApiPropertyOptional({ description: 'Ticket type description' })
  @IsOptional()
  @ValidateIf(
    (o: UpdateTicketTypeDto) =>
      o.description !== undefined &&
      o.description !== null &&
      o.description !== '',
  )
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Price in cents (non-negative integer)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Price must be an integer (in cents)' })
  @Min(0, { message: 'Price must be non-negative' })
  priceCents?: number;

  @ApiPropertyOptional({ description: 'Total quantity available', minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(0, { message: 'Quantity must be non-negative' })
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Maximum tickets per order',
    minimum: 1,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateTicketTypeDto) =>
      o.maxPerOrder !== undefined && o.maxPerOrder !== null,
  )
  @IsInt({ message: 'Max per order must be an integer' })
  @Min(1, { message: 'Max per order must be at least 1' })
  @Type(() => Number)
  maxPerOrder?: number;

  @ApiPropertyOptional({
    description: 'Sales start date/time (ISO 8601)',
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateTicketTypeDto) =>
      o.salesStartAt !== undefined &&
      o.salesStartAt !== null &&
      o.salesStartAt !== '',
  )
  @IsDateString(
    {},
    { message: 'Sales start must be a valid ISO 8601 date string' },
  )
  salesStartAt?: string;

  @ApiPropertyOptional({
    description: 'Sales end date/time (ISO 8601)',
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateTicketTypeDto) =>
      o.salesEndAt !== undefined &&
      o.salesEndAt !== null &&
      o.salesEndAt !== '',
  )
  @IsDateString(
    {},
    { message: 'Sales end must be a valid ISO 8601 date string' },
  )
  salesEndAt?: string;

  @ApiPropertyOptional({
    description: 'Allow payment in installments',
  })
  @IsOptional()
  @IsBoolean()
  allowInstallments?: boolean;

  @ApiPropertyOptional({
    description:
      'Installment configuration (required if allowInstallments is true)',
    type: InstallmentConfigDto,
  })
  @IsOptional()
  @ValidateIf((o: UpdateTicketTypeDto) => o.allowInstallments === true)
  @ValidateNested()
  @Type(() => InstallmentConfigDto)
  installmentConfig?: InstallmentConfigDto;
}
