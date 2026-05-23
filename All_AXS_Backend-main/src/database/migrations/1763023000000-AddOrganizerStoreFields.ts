import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds branded organizer storefront fields to `organizer_profiles`.
 * Powers the public `/o/:slug` storefront: a unique slug, marketing bio,
 * logo + brand colour, and an on/off toggle for the public page.
 */
export class AddOrganizerStoreFields1763023000000
  implements MigrationInterface
{
  name = 'AddOrganizerStoreFields1763023000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizer_profiles"
        ADD COLUMN IF NOT EXISTS "store_slug"   VARCHAR(120),
        ADD COLUMN IF NOT EXISTS "bio"          TEXT,
        ADD COLUMN IF NOT EXISTS "logo_url"     VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "brand_color"  VARCHAR(16),
        ADD COLUMN IF NOT EXISTS "store_public" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_organizer_profiles_store_slug"
        ON "organizer_profiles" ("store_slug")
        WHERE "store_slug" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_organizer_profiles_store_slug"`,
    );
    await queryRunner.query(`
      ALTER TABLE "organizer_profiles"
        DROP COLUMN IF EXISTS "store_public",
        DROP COLUMN IF EXISTS "brand_color",
        DROP COLUMN IF EXISTS "logo_url",
        DROP COLUMN IF EXISTS "bio",
        DROP COLUMN IF EXISTS "store_slug"
    `);
  }
}
