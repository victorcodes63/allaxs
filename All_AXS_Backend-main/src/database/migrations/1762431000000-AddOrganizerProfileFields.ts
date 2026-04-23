import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizerProfileFields1762431000000
  implements MigrationInterface
{
  name = 'AddOrganizerProfileFields1762431000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create PayoutMethod enum if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payout_method_enum" AS ENUM('BANK_ACCOUNT', 'MPESA', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to organizer_profiles table
    await queryRunner.query(`
      ALTER TABLE "organizer_profiles"
      ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "website" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "support_email" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "support_phone" VARCHAR(32),
      ADD COLUMN IF NOT EXISTS "payout_method" payout_method_enum,
      ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "bank_account_name" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "bank_account_number" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "mpesa_paybill" VARCHAR(64),
      ADD COLUMN IF NOT EXISTS "mpesa_till_number" VARCHAR(64),
      ADD COLUMN IF NOT EXISTS "tax_id" VARCHAR(64)
    `);

    // Make support_email required (set default for existing rows, then make NOT NULL)
    await queryRunner.query(`
      UPDATE "organizer_profiles"
      SET "support_email" = 'support@example.com'
      WHERE "support_email" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "organizer_profiles"
      ALTER COLUMN "support_email" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "organizer_profiles"
      DROP COLUMN IF EXISTS "tax_id",
      DROP COLUMN IF EXISTS "mpesa_till_number",
      DROP COLUMN IF EXISTS "mpesa_paybill",
      DROP COLUMN IF EXISTS "bank_account_number",
      DROP COLUMN IF EXISTS "bank_account_name",
      DROP COLUMN IF EXISTS "bank_name",
      DROP COLUMN IF EXISTS "payout_method",
      DROP COLUMN IF EXISTS "support_phone",
      DROP COLUMN IF EXISTS "support_email",
      DROP COLUMN IF EXISTS "website",
      DROP COLUMN IF EXISTS "legal_name"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "payout_method_enum"
    `);
  }
}
