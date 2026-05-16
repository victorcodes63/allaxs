import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CouponType } from 'src/domain/enums';

/**
 * Create-coupon payload. The service normalises `code` to upper-case and
 * trims surrounding whitespace before persisting; `currency` is upper-cased
 * as well so the same coupon is queryable however the organizer typed it.
 *
 * Per COUPONS_SPEC §1.1, every coupon is scoped to a single event — the
 * `eventId` lives in the path (`POST /events/:eventId/coupons`).
 */
export class CreateCouponDto {
  @ApiProperty({
    description:
      'Marketing code (case-insensitive at lookup; stored upper-cased). 2-64 chars, A-Z 0-9 - _ only.',
    minLength: 2,
    maxLength: 64,
  })
  @IsString()
  @Length(2, 64, { message: 'Code must be between 2 and 64 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: 'Code may contain only letters, numbers, dashes, and underscores',
  })
  code!: string;

  @ApiProperty({
    description: 'Discount kind — FIXED amount or PERCENT off',
    enum: CouponType,
  })
  @IsEnum(CouponType, { message: 'kind must be FIXED or PERCENT' })
  kind!: CouponType;

  @ApiPropertyOptional({
    description:
      'Discount value in minor units (cents). Required when kind=FIXED.',
    minimum: 1,
  })
  @ValidateIf((o: CreateCouponDto) => o.kind === CouponType.FIXED)
  @Type(() => Number)
  @IsInt({ message: 'valueCents must be an integer (minor units)' })
  @Min(1, { message: 'valueCents must be at least 1' })
  valueCents?: number;

  @ApiPropertyOptional({
    description: 'Percent off (1-100). Required when kind=PERCENT.',
    minimum: 1,
    maximum: 100,
  })
  @ValidateIf((o: CreateCouponDto) => o.kind === CouponType.PERCENT)
  @Type(() => Number)
  @IsInt({ message: 'percentOff must be an integer' })
  @Min(1, { message: 'percentOff must be at least 1' })
  @Max(100, { message: 'percentOff cannot exceed 100' })
  percentOff?: number;

  @ApiPropertyOptional({
    description: 'Validity start (ISO 8601). When omitted, valid immediately.',
  })
  @IsOptional()
  @ValidateIf(
    (o: CreateCouponDto) =>
      o.startAt !== undefined && o.startAt !== null && o.startAt !== '',
  )
  @IsDateString(
    {},
    { message: 'startAt must be a valid ISO 8601 date string' },
  )
  startAt?: string;

  @ApiPropertyOptional({
    description: 'Validity end (ISO 8601). When omitted, never expires.',
  })
  @IsOptional()
  @ValidateIf(
    (o: CreateCouponDto) =>
      o.endAt !== undefined && o.endAt !== null && o.endAt !== '',
  )
  @IsDateString({}, { message: 'endAt must be a valid ISO 8601 date string' })
  endAt?: string;

  @ApiPropertyOptional({
    description: 'Total redemption cap. Omit for unlimited.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'usageLimit must be an integer' })
  @Min(1, { message: 'usageLimit must be at least 1' })
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'Max redemptions per individual buyer. Omit for unlimited.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'perUserLimit must be an integer' })
  @Min(1, { message: 'perUserLimit must be at least 1' })
  perUserLimit?: number;

  @ApiPropertyOptional({
    description: 'Minimum order subtotal (minor units) for the code to apply.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minOrderCents must be an integer' })
  @Min(0, { message: 'minOrderCents must be non-negative' })
  minOrderCents?: number;

  @ApiPropertyOptional({
    description:
      'Restrict the coupon to orders in this ISO 4217 currency. Omit to allow any currency.',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
