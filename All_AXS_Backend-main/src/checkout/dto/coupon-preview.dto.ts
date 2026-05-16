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

class CouponPreviewLineDto {
  @IsUUID()
  ticketTypeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * Buyer-side coupon dry-run. Mirrors `PaystackInitDto.lines` so the
 * frontend can call this from the buyer step without re-shaping its
 * cart. Returns `{ valid, errorCode?, discountCents?, ... }` — see
 * `CheckoutService.previewCoupon`.
 *
 * `buyerEmail` is optional so anonymous buyers can preview the code
 * before they fill in their details; the authoritative per-user cap
 * check happens again at redeem time.
 */
export class CouponPreviewDto {
  @IsUUID()
  eventId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CouponPreviewLineDto)
  lines!: CouponPreviewLineDto[];

  @IsString()
  couponCode!: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;
}
