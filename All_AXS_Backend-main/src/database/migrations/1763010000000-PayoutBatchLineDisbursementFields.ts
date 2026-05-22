import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayoutBatchLineDisbursementFields1763010000000
  implements MigrationInterface
{
  name = 'PayoutBatchLineDisbursementFields1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payout_batch_lines"
      ADD COLUMN IF NOT EXISTS "external_reference" varchar(255),
      ADD COLUMN IF NOT EXISTS "disbursement_error" text,
      ADD COLUMN IF NOT EXISTS "disbursed_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payout_batch_lines"
      DROP COLUMN IF EXISTS "disbursed_at",
      DROP COLUMN IF EXISTS "disbursement_error",
      DROP COLUMN IF EXISTS "external_reference"
    `);
  }
}
