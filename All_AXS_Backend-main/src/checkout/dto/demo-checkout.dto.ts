import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DemoCheckoutLineDto {
  @IsUUID()
  ticketTypeId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DemoCheckoutDto {
  @IsUUID()
  eventId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DemoCheckoutLineDto)
  lines!: DemoCheckoutLineDto[];

  @IsString()
  @MinLength(2)
  buyerName!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;

  /**
   * Optional coupon code. Mirrors `PaystackInitDto.couponCode` — the
   * demo path applies the same redeem logic so dev environments can
   * exercise coupons end-to-end without Paystack.
   */
  @IsOptional()
  @IsString()
  couponCode?: string;
}
