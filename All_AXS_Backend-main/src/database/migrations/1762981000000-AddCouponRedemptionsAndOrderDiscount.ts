import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 2 of the coupons feature (see `All_AXS_Web-main/docs/COUPONS_SPEC.md`).
 *
 * Adds the redemption ledger and the discount columns on `orders`:
 *
 *   - `coupon_redemptions` — one row per successful redemption. Enforces
 *     the "one coupon per order" decision via a UNIQUE constraint on
 *     `order_id`, and supplies the per-user cap lookup via
 *     `(coupon_id, user_id)` and `(coupon_id, email)` indexes (logged-in
 *     buyers vs guest checkout).
 *   - `orders.applied_coupon_id` — convenience pointer so order summaries
 *     don't have to join through `coupon_redemptions`.
 *   - `orders.discount_cents` — the discount locked in at order creation
 *     time. `Order.amountCents` continues to mean post-discount buyer
 *     total; gross can be recomputed as `amountCents + discountCents`.
 *
 * All operations are guarded with `IF EXISTS` / `IF NOT EXISTS` so the
 * migration is safe to re-run on dirty environments. `down()` is a
 * strict inverse.
 */
export class AddCouponRedemptionsAndOrderDiscount1762981000000
  implements MigrationInterface
{
  name = 'AddCouponRedemptionsAndOrderDiscount1762981000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "coupon_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "user_id" uuid,
        "email" citext NOT NULL,
        "discount_cents" integer NOT NULL,
        "currency" char(3) NOT NULL,
        CONSTRAINT "PK_coupon_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupon_redemptions_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_coupon_redemptions_coupon" FOREIGN KEY ("coupon_id")
          REFERENCES "coupons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_redemptions_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_redemptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_coupon_redemptions_discount_positive"
          CHECK ("discount_cents" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coupon_redemptions_coupon_user"
      ON "coupon_redemptions" ("coupon_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coupon_redemptions_coupon_email"
      ON "coupon_redemptions" ("coupon_id", "email")
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "applied_coupon_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "discount_cents" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_applied_coupon'
        ) THEN
          ALTER TABLE "orders"
          ADD CONSTRAINT "FK_orders_applied_coupon"
          FOREIGN KEY ("applied_coupon_id")
          REFERENCES "coupons"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_orders_discount_cents_non_negative'
        ) THEN
          ALTER TABLE "orders"
          ADD CONSTRAINT "CHK_orders_discount_cents_non_negative"
          CHECK ("discount_cents" >= 0);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_applied_coupon_id"
      ON "orders" ("applied_coupon_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_orders_applied_coupon_id"
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_orders_discount_cents_non_negative'
        ) THEN
          ALTER TABLE "orders"
          DROP CONSTRAINT "CHK_orders_discount_cents_non_negative";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_applied_coupon'
        ) THEN
          ALTER TABLE "orders"
          DROP CONSTRAINT "FK_orders_applied_coupon";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "discount_cents"
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "applied_coupon_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_coupon_redemptions_coupon_email"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_coupon_redemptions_coupon_user"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "coupon_redemptions"
    `);
  }
}
