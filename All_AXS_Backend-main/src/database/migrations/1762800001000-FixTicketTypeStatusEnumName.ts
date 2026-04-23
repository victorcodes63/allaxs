import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix enum name to match TypeORM's expected pattern: ticket_types_status_enum
 * TypeORM automatically infers enum names as {table_name}_{column_name}_enum
 */
export class FixTicketTypeStatusEnumName1762800001000
  implements MigrationInterface
{
  name = 'FixTicketTypeStatusEnumName1762800001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if old enum exists and new enum doesn't
    const oldEnumExists = (await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'ticket_type_status_enum'
    `)) as Array<unknown>;

    const newEnumExists = (await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'ticket_types_status_enum'
    `)) as Array<unknown>;

    // If old enum exists and new doesn't, rename it
    if (oldEnumExists.length > 0 && newEnumExists.length === 0) {
      await queryRunner.query(`
        ALTER TYPE "ticket_type_status_enum" RENAME TO "ticket_types_status_enum"
      `);
    } else if (oldEnumExists.length === 0 && newEnumExists.length === 0) {
      // Neither exists, create the correct one
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "ticket_types_status_enum" AS ENUM('ACTIVE', 'DISABLED', 'SOLD_OUT');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Update the column to use the new enum type if status column exists
      await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ticket_types' AND column_name = 'status'
          ) THEN
            ALTER TABLE "ticket_types"
            ALTER COLUMN "status" TYPE ticket_types_status_enum
            USING "status"::text::ticket_types_status_enum;
          END IF;
        END $$;
      `);
    }
    // If new enum already exists, do nothing
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rename back to old name if needed
    const newEnumExists = (await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'ticket_types_status_enum'
    `)) as Array<unknown>;

    const oldEnumExists = (await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'ticket_type_status_enum'
    `)) as Array<unknown>;

    if (newEnumExists.length > 0 && oldEnumExists.length === 0) {
      await queryRunner.query(`
        ALTER TYPE "ticket_types_status_enum" RENAME TO "ticket_type_status_enum"
      `);
    }
  }
}
