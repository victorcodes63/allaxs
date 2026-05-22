import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaitlistEntries1763010000000 implements MigrationInterface {
  name = 'CreateWaitlistEntries1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_entries_status_enum') THEN
          CREATE TYPE "waitlist_entries_status_enum" AS ENUM(
            'WAITING', 'NOTIFIED', 'PURCHASED', 'EXPIRED', 'CANCELLED'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "waitlist_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "event_id" uuid NOT NULL,
        "tier_id" uuid NOT NULL,
        "email" citext NOT NULL,
        "user_id" uuid,
        "position" integer NOT NULL,
        "status" "waitlist_entries_status_enum" NOT NULL DEFAULT 'WAITING',
        "notified_at" TIMESTAMPTZ,
        "offer_expires_at" TIMESTAMPTZ,
        CONSTRAINT "PK_waitlist_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_waitlist_entries_event" FOREIGN KEY ("event_id")
          REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_waitlist_entries_tier" FOREIGN KEY ("tier_id")
          REFERENCES "ticket_types"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_waitlist_entries_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_waitlist_entries_position_positive"
          CHECK ("position" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_waitlist_entries_tier_status_position"
      ON "waitlist_entries" ("tier_id", "status", "position")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_waitlist_entries_tier_email_active"
      ON "waitlist_entries" ("tier_id", "email")
      WHERE "status" IN ('WAITING', 'NOTIFIED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_waitlist_entries_tier_email_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_waitlist_entries_tier_status_position"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "waitlist_entries"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "waitlist_entries_status_enum"
    `);
  }
}
