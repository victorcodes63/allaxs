import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MVP affiliate program: organizers can mint codes (org-wide or scoped
 * to a single event) with a percentage commission. Each conversion is
 * recorded against an order so commission owed can be totalled per code.
 */
export class CreateAffiliateCodes1763022000000 implements MigrationInterface {
  name = 'CreateAffiliateCodes1763022000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "organizer_profile_id" uuid NOT NULL,
        "event_id" uuid,
        "code" VARCHAR(80) NOT NULL,
        "commission_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" TEXT,
        CONSTRAINT "PK_affiliate_codes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_affiliate_codes_organizer"
          FOREIGN KEY ("organizer_profile_id")
          REFERENCES "organizer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_affiliate_codes_event"
          FOREIGN KEY ("event_id")
          REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_affiliate_codes_commission_range"
          CHECK ("commission_percent" >= 0 AND "commission_percent" <= 100)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_affiliate_codes_org_code"
        ON "affiliate_codes" ("organizer_profile_id", "code")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_codes_event"
        ON "affiliate_codes" ("event_id")
        WHERE "event_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_conversions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "affiliate_code_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "commission_cents" integer NOT NULL DEFAULT 0,
        "currency" CHAR(3) NOT NULL DEFAULT 'KES',
        CONSTRAINT "PK_affiliate_conversions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_affiliate_conversions_code"
          FOREIGN KEY ("affiliate_code_id")
          REFERENCES "affiliate_codes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_affiliate_conversions_order"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_affiliate_conversions_order"
          UNIQUE ("order_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_conversions_code"
        ON "affiliate_conversions" ("affiliate_code_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_affiliate_conversions_code"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate_conversions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_affiliate_codes_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_affiliate_codes_org_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate_codes"`);
  }
}
