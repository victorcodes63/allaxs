import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the scanner_sessions table for door-scanning / event check-in sessions.
 * Also adds scanner_session_id FK on checkins so each check-in can be traced back
 * to the scanner session that performed it.
 */
export class CreateScannerSessions1763000000000 implements MigrationInterface {
  name = 'CreateScannerSessions1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "scanner_sessions" (
        "id"                        UUID            NOT NULL DEFAULT uuid_generate_v4(),
        "event_id"                  UUID            NOT NULL,
        "created_by_organizer_id"   UUID            NOT NULL,
        "label"                     VARCHAR(80)     NOT NULL,
        "token"                     VARCHAR(120)    NOT NULL,
        "expires_at"                TIMESTAMPTZ     NOT NULL,
        "revoked_at"                TIMESTAMPTZ     NULL,
        "zone_scope"                VARCHAR(60)     NULL,
        "createdAt"                 TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updatedAt"                 TIMESTAMPTZ     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scanner_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_scanner_sessions_token" UNIQUE ("token"),
        CONSTRAINT "FK_scanner_sessions_event"
          FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_scanner_sessions_organizer"
          FOREIGN KEY ("created_by_organizer_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_scanner_sessions_event_id" ON "scanner_sessions" ("event_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_scanner_sessions_token" ON "scanner_sessions" ("token")
    `);

    await queryRunner.query(`
      ALTER TABLE "checkins"
      ADD COLUMN IF NOT EXISTS "scanner_session_id" UUID NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "checkins"
      ADD CONSTRAINT "FK_checkins_scanner_session"
        FOREIGN KEY ("scanner_session_id")
        REFERENCES "scanner_sessions"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_checkins_scanner_session_id" ON "checkins" ("scanner_session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_checkins_scanner_session_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "checkins"
      DROP CONSTRAINT IF EXISTS "FK_checkins_scanner_session"
    `);
    await queryRunner.query(`
      ALTER TABLE "checkins"
      DROP COLUMN IF EXISTS "scanner_session_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "scanner_sessions"
    `);
  }
}
