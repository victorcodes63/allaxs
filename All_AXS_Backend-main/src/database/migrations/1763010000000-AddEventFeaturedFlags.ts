import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds homepage featured curation columns on `events`.
 * Admins toggle `is_featured`; optional `featured_sort_order` controls rail order.
 */
export class AddEventFeaturedFlags1763010000000 implements MigrationInterface {
  name = 'AddEventFeaturedFlags1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "featured_sort_order" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_is_featured"
       ON "events" ("is_featured")
       WHERE "is_featured" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_is_featured"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "featured_sort_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "is_featured"`,
    );
  }
}
