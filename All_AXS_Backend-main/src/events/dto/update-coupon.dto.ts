import { PartialType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';

/**
 * Update-coupon payload. Every field is optional. The service additionally
 * locks the `code` and `kind` fields once `usedCount > 0` (returns 409) so
 * a redeemed code can't be silently swapped under buyers' feet.
 */
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
