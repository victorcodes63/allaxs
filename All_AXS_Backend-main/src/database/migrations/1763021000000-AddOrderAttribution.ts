import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional marketing attribution columns to `orders` so checkout
 * can persist where the buyer came from (UTM source / medium / campaign,
 * raw HTTP referrer, and an optional affiliate code applied at checkout).
 *
 * All columns are nullable so existing rows keep working and clients
 * that do not pass attribution fields are unaffected.
 */
export class AddOrderAttribution1763021000000 implements MigrationInterface {
  name = 'AddOrderAttribution1763021000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "utm_source"   VARCHAR(120),
        ADD COLUMN IF NOT EXISTS "utm_medium"   VARCHAR(120),
        ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(180),
        ADD COLUMN IF NOT EXISTS "referrer"     VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "affiliate_code" VARCHAR(80)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_utm_source"
        ON "orders" ("utm_source")
        WHERE "utm_source" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_affiliate_code"
        ON "orders" ("affiliate_code")
        WHERE "affiliate_code" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_affiliate_code"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_utm_source"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "affiliate_code",
        DROP COLUMN IF EXISTS "referrer",
        DROP COLUMN IF EXISTS "utm_campaign",
        DROP COLUMN IF EXISTS "utm_medium",
        DROP COLUMN IF EXISTS "utm_source"
    `);
  }
}
