import {
  resolveRefundAmountCents,
  STANDARD_REFUND_PERCENT,
} from './refund-policy';

describe('refund-policy', () => {
  it('calculates 75% policy refund', () => {
    const result = resolveRefundAmountCents(10000, 'POLICY');
    expect(result.refundAmountCents).toBe(7500);
    expect(result.retainedCents).toBe(2500);
    expect(result.isPartialRefund).toBe(true);
    expect(STANDARD_REFUND_PERCENT).toBe(75);
  });

  it('returns full amount for FULL mode', () => {
    const result = resolveRefundAmountCents(24900, 'FULL');
    expect(result.refundAmountCents).toBe(24900);
    expect(result.isPartialRefund).toBe(false);
  });

  it('accepts custom amount', () => {
    const result = resolveRefundAmountCents(10000, 'CUSTOM', 5000);
    expect(result.refundAmountCents).toBe(5000);
    expect(result.retainedCents).toBe(5000);
  });

  it('rejects custom amount above order total', () => {
    expect(() => resolveRefundAmountCents(10000, 'CUSTOM', 10001)).toThrow();
  });
});
