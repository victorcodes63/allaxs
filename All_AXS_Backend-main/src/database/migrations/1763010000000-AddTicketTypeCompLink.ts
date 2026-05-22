import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AUDIT-C4 — hidden comp/VIP tiers with unguessable share tokens.
 *
 * Adds:
 *   - `ticket_types.is_hidden` — tier omitted from public event listings
 *   - `ticket_types.comp_link_token` — secret token for `/e/:slug/comp/:token`
 */
export class AddTicketTypeCompLink1763010000000 implements MigrationInterface {
  name = 'AddTicketTypeCompLink1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      ADD COLUMN IF NOT EXISTS "is_hidden" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      ADD COLUMN IF NOT EXISTS "comp_link_token" varchar(64) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ticket_types_comp_link_token"
      ON "ticket_types" ("comp_link_token")
      WHERE "comp_link_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_ticket_types_comp_link_token"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      DROP COLUMN IF EXISTS "comp_link_token"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      DROP COLUMN IF EXISTS "is_hidden"
    `);
  }
}
