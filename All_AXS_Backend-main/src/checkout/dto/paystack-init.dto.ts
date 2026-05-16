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

  /**
   * Optional coupon code applied at checkout. See COUPONS_SPEC §5.1.
   * The backend re-validates and locks the coupon row inside the
   * checkout transaction, so the value supplied here is a hint that
   * must still survive the authoritative redeem step.
   */
  @IsOptional()
  @IsString()
  couponCode?: string;
}
