export const STANDARD_REFUND_PERCENT = 75;

export type RefundMode = "POLICY" | "FULL" | "CUSTOM";

export function calculatePolicyRefundCents(orderAmountCents: number): number {
  return Math.floor((orderAmountCents * STANDARD_REFUND_PERCENT) / 100);
}

export function resolveRefundPreview(
  orderAmountCents: number,
  refundMode: RefundMode,
  customAmountCents?: number,
): {
  refundAmountCents: number;
  retainedCents: number;
  isPartialRefund: boolean;
} {
  let refundAmountCents: number;
  switch (refundMode) {
    case "FULL":
      refundAmountCents = orderAmountCents;
      break;
    case "CUSTOM":
      refundAmountCents = customAmountCents ?? 0;
      break;
    case "POLICY":
    default:
      refundAmountCents = calculatePolicyRefundCents(orderAmountCents);
      break;
  }
  return {
    refundAmountCents,
    retainedCents: Math.max(0, orderAmountCents - refundAmountCents),
    isPartialRefund: refundAmountCents > 0 && refundAmountCents < orderAmountCents,
  };
}

export function refundModeLabel(mode: RefundMode): string {
  switch (mode) {
    case "POLICY":
      return `Policy (${STANDARD_REFUND_PERCENT}%)`;
    case "FULL":
      return "Full refund (100%)";
    case "CUSTOM":
      return "Custom amount";
    default:
      return mode;
  }
}
