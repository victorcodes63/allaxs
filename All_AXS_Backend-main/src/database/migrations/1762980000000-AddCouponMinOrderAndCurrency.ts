import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 1 of the coupons feature (see `All_AXS_Web-main/docs/COUPONS_SPEC.md`).
 *
 * Adds two new columns on `coupons` and tightens the foreign key:
 *
 *   - `min_order_cents` (nullable integer) — optional subtotal floor; orders
 *     below this value cannot redeem the coupon.
 *   - `currency` (nullable char(3)) — when set, only orders in this currency
 *     may redeem; `NULL` means "any currency".
 *   - `event_id` is promoted to `NOT NULL`. Per the product decision in §1.1
 *     of the spec, coupons are scoped per-event; platform-wide codes are
 *     out of scope.
 *
 * Defensive: any pre-existing rows with `event_id IS NULL` are deleted
 * before the NOT NULL promotion. The `coupons` table has never been
 * exposed to a CRUD path so this is expected to be a no-op in every
 * environment, but the cleanup keeps the migration safe to re-run on
 * dirty databases (same posture as `UnifyForeignKeyColumns1762950000000`).
 */
export class AddCouponMinOrderAndCurrency1762980000000
  implements MigrationInterface
{
  name = 'AddCouponMinOrderAndCurrency1762980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "min_order_cents" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "currency" char(3)
    `);

    // Optional sanity constraint: percent coupons land in 1..100.
    // FIXED coupons get a positive-value constraint at the same time.
    // Skipped if the constraint already exists.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_percent_off_range'
        ) THEN
          ALTER TABLE "coupons"
          ADD CONSTRAINT "CHK_coupons_percent_off_range"
          CHECK ("percentOff" IS NULL OR ("percentOff" BETWEEN 1 AND 100));
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_value_cents_positive'
        ) THEN
          ALTER TABLE "coupons"
          ADD CONSTRAINT "CHK_coupons_value_cents_positive"
          CHECK ("valueCents" IS NULL OR "valueCents" > 0);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_min_order_cents_positive'
        ) THEN
          ALTER TABLE "coupons"
          ADD CONSTRAINT "CHK_coupons_min_order_cents_positive"
          CHECK ("min_order_cents" IS NULL OR "min_order_cents" >= 0);
        END IF;
      END $$;
    `);

    // Defensive cleanup so the NOT NULL promotion below doesn't trip on
    // historic NULL rows. Coupons have never been used in production but
    // tests / seeds may have inserted orphan rows.
    await queryRunner.query(`
      DELETE FROM "coupons" WHERE "event_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons"
      ALTER COLUMN "event_id" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ALTER COLUMN "event_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_min_order_cents_positive'
        ) THEN
          ALTER TABLE "coupons"
          DROP CONSTRAINT "CHK_coupons_min_order_cents_positive";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_value_cents_positive'
        ) THEN
          ALTER TABLE "coupons"
          DROP CONSTRAINT "CHK_coupons_value_cents_positive";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_coupons_percent_off_range'
        ) THEN
          ALTER TABLE "coupons"
          DROP CONSTRAINT "CHK_coupons_percent_off_range";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "currency"
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "min_order_cents"
    `);
  }
}
