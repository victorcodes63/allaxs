import { BadRequestException } from '@nestjs/common';

/** Matches All AXS published refund policy (75% to buyer, 25% retained). */
export const STANDARD_REFUND_PERCENT = 75;

export type RefundMode = 'POLICY' | 'FULL' | 'CUSTOM';

export function normalizeRefundMode(raw?: string | null): RefundMode {
  if (raw === 'FULL' || raw === 'CUSTOM' || raw === 'POLICY') {
    return raw;
  }
  return 'POLICY';
}

export function resolveRefundAmountCents(
  orderAmountCents: number,
  mode: RefundMode,
  customAmountCents?: number,
): {
  refundAmountCents: number;
  retainedCents: number;
  refundMode: RefundMode;
  isPartialRefund: boolean;
} {
  if (!Number.isInteger(orderAmountCents) || orderAmountCents <= 0) {
    throw new BadRequestException('Order amount is invalid for refund');
  }

  let refundAmountCents: number;
  switch (mode) {
    case 'FULL':
      refundAmountCents = orderAmountCents;
      break;
    case 'CUSTOM': {
      if (
        customAmountCents === undefined ||
        !Number.isInteger(customAmountCents)
      ) {
        throw new BadRequestException(
          'Custom refund amount (amountCents) is required for CUSTOM mode',
        );
      }
      refundAmountCents = customAmountCents;
      break;
    }
    case 'POLICY':
    default:
      refundAmountCents = Math.floor(
        (orderAmountCents * STANDARD_REFUND_PERCENT) / 100,
      );
      break;
  }

  if (refundAmountCents <= 0) {
    throw new BadRequestException('Refund amount must be greater than zero');
  }
  if (refundAmountCents > orderAmountCents) {
    throw new BadRequestException(
      'Refund amount cannot exceed the original order total',
    );
  }

  return {
    refundAmountCents,
    retainedCents: orderAmountCents - refundAmountCents,
    refundMode: mode,
    isPartialRefund: refundAmountCents < orderAmountCents,
  };
}
