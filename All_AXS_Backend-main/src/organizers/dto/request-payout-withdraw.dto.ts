import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * Minimum withdrawal amount in minor units (KES 5,000).
 * Kept in sync with the constant exposed by
 * `OrganizerPayoutRequestsService.MIN_WITHDRAWAL_CENTS` so the UI and
 * the API agree on the floor.
 */
export const MIN_WITHDRAWAL_CENTS = 500000;

export class RequestPayoutWithdrawDto {
  @ApiProperty({
    description:
      'Amount to withdraw in minor units (e.g. cents). Must be >= the minimum threshold and <= the organizer\'s available balance.',
    minimum: MIN_WITHDRAWAL_CENTS,
    example: MIN_WITHDRAWAL_CENTS,
  })
  @IsInt()
  @Min(MIN_WITHDRAWAL_CENTS)
  amountCents!: number;
}
