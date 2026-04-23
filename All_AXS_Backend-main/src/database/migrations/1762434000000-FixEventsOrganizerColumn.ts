import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixEventsOrganizerColumn1762434000000
  implements MigrationInterface
{
  name = 'FixEventsOrganizerColumn1762434000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The events table has both organizerId and organizer_id columns
    // organizer_id has the foreign key, organizerId is NOT NULL but unused
    // We need to:
    // 1. Sync organizer_id from organizerId if organizer_id is null
    // 2. Make organizer_id NOT NULL
    // 3. Drop the organizerId column and its index
    // 4. Update the index on organizer_id if needed

    // Step 1: Sync organizer_id from organizerId for any rows where organizer_id is null
    await queryRunner.query(`
      UPDATE "events"
      SET "organizer_id" = "organizerId"
      WHERE "organizer_id" IS NULL AND "organizerId" IS NOT NULL
    `);

    // Step 2: Make organizer_id NOT NULL (it should already have values from the sync)
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "organizer_id" SET NOT NULL
    `);

    // Step 3: Drop the index on organizerId
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_1024d476207981d1c72232cf3c"
    `);

    // Step 4: Drop the organizerId column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "organizerId"
    `);

    // Step 5: Create index on organizer_id if it doesn't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_events_organizer_id" ON "events" ("organizer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Add back organizerId column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "organizerId" uuid
    `);

    // Sync data from organizer_id to organizerId
    await queryRunner.query(`
      UPDATE "events"
      SET "organizerId" = "organizer_id"
      WHERE "organizerId" IS NULL
    `);

    // Make organizerId NOT NULL
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "organizerId" SET NOT NULL
    `);

    // Create index on organizerId
    await queryRunner.query(`
      CREATE INDEX "IDX_1024d476207981d1c72232cf3c" ON "events" ("organizerId")
    `);

    // Make organizer_id nullable again
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "organizer_id" DROP NOT NULL
    `);

    // Drop index on organizer_id if it exists
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_events_organizer_id"
    `);
  }
}
