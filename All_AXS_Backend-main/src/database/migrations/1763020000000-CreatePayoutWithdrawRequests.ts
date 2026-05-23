import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayoutWithdrawRequests1763020000000
  implements MigrationInterface
{
  name = 'CreatePayoutWithdrawRequests1763020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_withdraw_request_status_enum') THEN
          CREATE TYPE "payout_withdraw_request_status_enum" AS ENUM (
            'PENDING',
            'APPROVED',
            'PAID',
            'REJECTED',
            'CANCELLED'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_withdraw_requests" (
        "id"                     UUID NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
        "organizer_profile_id"   UUID NOT NULL,
        "amount_cents"           INTEGER NOT NULL,
        "currency"               CHAR(3) NOT NULL DEFAULT 'KES',
        "status"                 "payout_withdraw_request_status_enum"
                                 NOT NULL DEFAULT 'PENDING',
        "requested_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processed_at"           TIMESTAMPTZ NULL,
        "admin_note"             TEXT NULL,
        "metadata"               JSONB NULL,
        CONSTRAINT "PK_payout_withdraw_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payout_withdraw_requests_organizer"
          FOREIGN KEY ("organizer_profile_id")
          REFERENCES "organizer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_payout_withdraw_requests_amount_positive"
          CHECK ("amount_cents" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payout_withdraw_requests_organizer_status"
      ON "payout_withdraw_requests" ("organizer_profile_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payout_withdraw_requests_status"
      ON "payout_withdraw_requests" ("status")
    `);

    // Enforce at most one in-flight (PENDING or APPROVED) request per
    // organizer at the DB layer so concurrent requests can't slip past
    // the application check.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payout_withdraw_requests_open_per_organizer"
      ON "payout_withdraw_requests" ("organizer_profile_id")
      WHERE "status" IN ('PENDING', 'APPROVED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payout_withdraw_requests_open_per_organizer"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payout_withdraw_requests_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payout_withdraw_requests_organizer_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_withdraw_requests"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "payout_withdraw_request_status_enum"`,
    );
  }
}
