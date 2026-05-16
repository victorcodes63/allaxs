import { computePlatformFeeCents } from './platform-fee.util';

function env(map: Record<string, string>) {
  return (key: string) => map[key];
}

describe('computePlatformFeeCents', () => {
  it('returns 0 for non-positive subtotal', () => {
    expect(computePlatformFeeCents(0, env({ PLATFORM_FEE_BPS: '500' }))).toBe(0);
    expect(computePlatformFeeCents(-1, env({}))).toBe(0);
  });

  it('computes bps', () => {
    expect(computePlatformFeeCents(10_000, env({ PLATFORM_FEE_BPS: '500' }))).toBe(500);
    expect(computePlatformFeeCents(100, env({ PLATFORM_FEE_BPS: '500' }))).toBe(5);
  });

  it('adds fixed', () => {
    expect(
      computePlatformFeeCents(5000, env({ PLATFORM_FEE_BPS: '0', PLATFORM_FEE_FIXED_CENTS: '199' })),
    ).toBe(199);
  });

  it('respects max', () => {
    expect(
      computePlatformFeeCents(10_000, env({ PLATFORM_FEE_BPS: '10000', PLATFORM_FEE_MAX_CENTS: '300' })),
    ).toBe(300);
  });

  it('caps at subtotal', () => {
    expect(
      computePlatformFeeCents(100, env({ PLATFORM_FEE_FIXED_CENTS: '999999' })),
    ).toBe(100);
  });
});
