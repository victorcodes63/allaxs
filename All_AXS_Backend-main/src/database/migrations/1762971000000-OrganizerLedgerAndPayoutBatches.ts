import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizerLedgerAndPayoutBatches1762971000000
  implements MigrationInterface
{
  name = 'OrganizerLedgerAndPayoutBatches1762971000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_entry_type_enum" AS ENUM(
          'ORDER_EARNINGS',
          'ORDER_REFUND_REVERSAL',
          'PAYOUT'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payout_batch_status_enum" AS ENUM(
          'DRAFT',
          'APPROVED',
          'EXPORTED',
          'MARKED_PAID',
          'CANCELLED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizer_ledger_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "organizer_id" uuid NOT NULL,
        "order_id" uuid,
        "entry_type" ledger_entry_type_enum NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" char(3) NOT NULL,
        "idempotency_key" varchar(128) NOT NULL,
        "metadata" jsonb,
        CONSTRAINT "PK_organizer_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizer_ledger_idempotency" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_ledger_organizer" FOREIGN KEY ("organizer_id")
          REFERENCES "organizer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ledger_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_organizer_created"
      ON "organizer_ledger_entries" ("organizer_id", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "status" payout_batch_status_enum NOT NULL DEFAULT 'DRAFT',
        "currency" char(3) NOT NULL DEFAULT 'KES',
        "notes" text,
        "external_reference" varchar(255),
        "created_by_user_id" uuid,
        "approved_at" TIMESTAMPTZ,
        "marked_paid_at" TIMESTAMPTZ,
        CONSTRAINT "PK_payout_batches" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_batch_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "batch_id" uuid NOT NULL,
        "organizer_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" char(3) NOT NULL,
        CONSTRAINT "PK_payout_batch_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payout_line_batch" FOREIGN KEY ("batch_id")
          REFERENCES "payout_batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payout_line_organizer" FOREIGN KEY ("organizer_id")
          REFERENCES "organizer_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payout_batch_lines_batch"
      ON "payout_batch_lines" ("batch_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payout_batch_lines_organizer"
      ON "payout_batch_lines" ("organizer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payout_batches_status_created"
      ON "payout_batches" ("status", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_batch_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizer_ledger_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payout_batch_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_entry_type_enum"`);
  }
}
