import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PaystackInitLineDto {
  @IsUUID()
  ticketTypeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PaystackInitDto {
  @IsUUID()
  eventId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaystackInitLineDto)
  lines!: PaystackInitLineDto[];

  @IsString()
  buyerName!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;
}
