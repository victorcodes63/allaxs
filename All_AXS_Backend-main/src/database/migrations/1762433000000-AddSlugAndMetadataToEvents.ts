import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlugAndMetadataToEvents1762433000000
  implements MigrationInterface
{
  name = 'AddSlugAndMetadataToEvents1762433000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add slug column (nullable first, we'll make it NOT NULL after populating)
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "slug" character varying(255)
    `);

    // Add metadata column (jsonb)
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "metadata" jsonb
    `);

    // Update title column length from 255 to 180
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "title" TYPE character varying(180)
    `);

    // Make description nullable
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "description" DROP NOT NULL
    `);

    // Generate slugs for existing events (if any)
    // Using a simple slugify: lowercase, replace spaces with hyphens, remove special chars
    await queryRunner.query(`
      UPDATE "events"
      SET "slug" = COALESCE(
        NULLIF(
          TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE("title", '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'))),
          ''
        ),
        'event-' || SUBSTRING("id"::text, 1, 8)
      )
      WHERE "slug" IS NULL
    `);

    // Handle duplicate slugs: keep the first event (by createdAt, then id) unchanged,
    // append ID suffix to all others to ensure uniqueness
    await queryRunner.query(`
      UPDATE "events" e1
      SET slug = e1.slug || '-' || SUBSTRING(e1.id::text, 1, 8)
      WHERE e1.slug IN (
        SELECT slug FROM "events"
        WHERE slug IS NOT NULL
        GROUP BY slug
        HAVING COUNT(*) > 1
      )
      AND e1.id NOT IN (
        SELECT DISTINCT ON (slug) id
        FROM "events"
        WHERE slug IS NOT NULL
        ORDER BY slug, "createdAt", id
      )
    `);

    // Create unique index after handling duplicates
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_events_slug" ON "events" ("slug")
    `);

    // Make slug NOT NULL after populating
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "slug" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop slug index and column
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_events_slug"
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "slug"
    `);

    // Drop metadata column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "metadata"
    `);

    // Revert title column length to 255
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "title" TYPE character varying(255)
    `);

    // Make description NOT NULL again
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "description" SET NOT NULL
    `);
  }
}
