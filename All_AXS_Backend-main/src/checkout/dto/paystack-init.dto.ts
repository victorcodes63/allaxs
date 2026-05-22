import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

  /** Internal flag for public guest checkout (set server-side). */
  @IsOptional()
  guestCheckout?: boolean;

  /**
   * When true, creates a payment plan and charges only installment 1 via
   * Paystack. Requires a single cart line on a tier with allowInstallments.
   */
  @IsOptional()
  @IsBoolean()
  payInInstallments?: boolean;

  /** Signed waitlist purchase token from notification email (30 min). */
  @IsOptional()
  @IsString()
  waitlistToken?: string;

  /**
   * When `email_and_whatsapp` and `buyerPhone` are set, the API sends a
   * WhatsApp template with ticket links after payment.
   */
  @IsOptional()
  @IsString()
  ticketDelivery?: 'account' | 'email' | 'email_and_whatsapp';
}
