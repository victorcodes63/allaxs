import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `events.submitted_at` — the moment an event first transitioned
 * from DRAFT (or REJECTED) into PENDING_REVIEW. Until now the admin
 * overview chart and pending-review feed have been piggy-backing on
 * `createdAt`, which mixes "draft created" with "submitted for review"
 * and makes the trend line less meaningful.
 *
 * Backfill strategy: for events that are already past the draft stage
 * (PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED, ARCHIVED, CANCELLED)
 * we set `submitted_at = createdAt` so the historic data lines up. Pure
 * DRAFT events keep `submitted_at = NULL` since they were never
 * submitted; once an organiser hits "Submit for review" the service
 * will populate it.
 */
export class AddEventSubmittedAt1762960000000 implements MigrationInterface {
  name = 'AddEventSubmittedAt1762960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "submitted_at" timestamptz`,
    );

    // Backfill: any event past DRAFT must have been submitted at some
    // point. Using createdAt is the safest approximation we have for
    // historic rows; new transitions populate this column directly.
    await queryRunner.query(
      `UPDATE "events"
       SET "submitted_at" = "createdAt"
       WHERE "submitted_at" IS NULL
         AND status <> 'DRAFT'`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_submitted_at"
       ON "events" ("submitted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_submitted_at"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "submitted_at"`,
    );
  }
}
