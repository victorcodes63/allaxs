import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketTypeDescriptionAndStatus1762800000000
  implements MigrationInterface
{
  name = 'AddTicketTypeDescriptionAndStatus1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create TicketTypeStatus enum if it doesn't exist
    // TypeORM uses pattern: {table_name}_{column_name}_enum
    // For ticket_types.status, it expects: ticket_types_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ticket_types_status_enum" AS ENUM('ACTIVE', 'DISABLED', 'SOLD_OUT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add description column (nullable)
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      ADD COLUMN IF NOT EXISTS "description" TEXT
    `);

    // Add status column with default
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      ADD COLUMN IF NOT EXISTS "status" ticket_types_status_enum NOT NULL DEFAULT 'ACTIVE'
    `);

    // Create index on status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ticket_types_status" ON "ticket_types" ("status")
    `);

    // Add unique constraint on (eventId, LOWER(name)) to prevent duplicate names per event
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ticket_types_event_name_unique"
      ON "ticket_types" ("eventId", LOWER("name"))
    `);

    // Add check constraints (only if they don't exist)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_ticket_types_quantity_non_negative'
        ) THEN
          ALTER TABLE "ticket_types"
          ADD CONSTRAINT "CHK_ticket_types_quantity_non_negative"
          CHECK ("quantityTotal" >= 0);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_ticket_types_max_per_order_positive'
        ) THEN
          ALTER TABLE "ticket_types"
          ADD CONSTRAINT "CHK_ticket_types_max_per_order_positive"
          CHECK ("maxPerOrder" IS NULL OR "maxPerOrder" > 0);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_ticket_types_max_per_order_positive'
        ) THEN
          ALTER TABLE "ticket_types"
          DROP CONSTRAINT "CHK_ticket_types_max_per_order_positive";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_ticket_types_quantity_non_negative'
        ) THEN
          ALTER TABLE "ticket_types"
          DROP CONSTRAINT "CHK_ticket_types_quantity_non_negative";
        END IF;
      END $$;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_types_event_name_unique"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_types_status"
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      DROP COLUMN IF EXISTS "status"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      DROP COLUMN IF EXISTS "description"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "ticket_types_status_enum"
    `);
  }
}
