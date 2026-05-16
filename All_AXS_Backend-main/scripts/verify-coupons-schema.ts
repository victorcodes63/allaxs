/**
 * Post-migration sanity check for the coupons feature. Confirms the
 * coupon-related schema objects landed on the current DATABASE_URL.
 *
 * Run with: `npx ts-node -r tsconfig-paths/register scripts/verify-coupons-schema.ts`
 *
 * Safe to run repeatedly. Exits with code 1 if any expected object is
 * missing.
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source.factory';

interface Row {
  table_name?: string;
  column_name?: string;
  data_type?: string;
  constraint_name?: string;
  indexname?: string;
}

async function main() {
  await AppDataSource.initialize();
  try {
    console.log('Connected to:', (await AppDataSource.query('SELECT current_database() db'))[0]?.db);

    const checks: Array<{ label: string; query: string; expected: number }> = [
      {
        label: 'coupons.min_order_cents column',
        query: `SELECT column_name FROM information_schema.columns WHERE table_name='coupons' AND column_name='min_order_cents'`,
        expected: 1,
      },
      {
        label: 'coupons.currency column',
        query: `SELECT column_name FROM information_schema.columns WHERE table_name='coupons' AND column_name='currency'`,
        expected: 1,
      },
      {
        label: 'coupons.event_id NOT NULL',
        query: `SELECT column_name FROM information_schema.columns WHERE table_name='coupons' AND column_name='event_id' AND is_nullable='NO'`,
        expected: 1,
      },
      {
        label: 'coupons CHK_coupons_percent_off_range',
        query: `SELECT conname FROM pg_constraint WHERE conname='CHK_coupons_percent_off_range'`,
        expected: 1,
      },
      {
        label: 'coupons CHK_coupons_value_cents_positive',
        query: `SELECT conname FROM pg_constraint WHERE conname='CHK_coupons_value_cents_positive'`,
        expected: 1,
      },
      {
        label: 'coupons CHK_coupons_min_order_cents_positive',
        query: `SELECT conname FROM pg_constraint WHERE conname='CHK_coupons_min_order_cents_positive'`,
        expected: 1,
      },
      {
        label: 'coupon_redemptions table',
        query: `SELECT table_name FROM information_schema.tables WHERE table_name='coupon_redemptions'`,
        expected: 1,
      },
      {
        label: 'coupon_redemptions UQ on order_id',
        query: `SELECT conname FROM pg_constraint WHERE conname='UQ_coupon_redemptions_order_id'`,
        expected: 1,
      },
      {
        label: 'coupon_redemptions FKs (coupon, order, user)',
        query: `SELECT conname FROM pg_constraint WHERE conname IN ('FK_coupon_redemptions_coupon','FK_coupon_redemptions_order','FK_coupon_redemptions_user')`,
        expected: 3,
      },
      {
        label: 'coupon_redemptions composite indexes',
        query: `SELECT indexname FROM pg_indexes WHERE tablename='coupon_redemptions' AND indexname IN ('IDX_coupon_redemptions_coupon_user','IDX_coupon_redemptions_coupon_email')`,
        expected: 2,
      },
      {
        label: 'orders.applied_coupon_id + FK',
        query: `SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='applied_coupon_id'
                UNION ALL SELECT 1 FROM pg_constraint WHERE conname='FK_orders_applied_coupon'`,
        expected: 2,
      },
      {
        label: 'orders.discount_cents + check + index',
        query: `SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_cents'
                UNION ALL SELECT 1 FROM pg_constraint WHERE conname='CHK_orders_discount_cents_non_negative'
                UNION ALL SELECT 1 FROM pg_indexes WHERE indexname='IDX_orders_applied_coupon_id'`,
        expected: 3,
      },
    ];

    let failed = 0;
    for (const check of checks) {
      const rows = (await AppDataSource.query(check.query)) as Row[];
      const ok = rows.length === check.expected;
      console.log(
        ok ? '✓' : '✗',
        check.label,
        ok ? '' : `(got ${rows.length}, expected ${check.expected})`,
      );
      if (!ok) failed += 1;
    }

    if (failed > 0) {
      console.error(`\n${failed} check(s) failed`);
      process.exit(1);
    }
    console.log('\nAll coupon schema checks passed.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
