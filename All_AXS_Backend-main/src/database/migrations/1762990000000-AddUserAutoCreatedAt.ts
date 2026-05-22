import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks accounts provisioned automatically during guest checkout so the
 * web app can show a first-time password-setup flow.
 */
export class AddUserAutoCreatedAt1762990000000 implements MigrationInterface {
  name = 'AddUserAutoCreatedAt1762990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "autoCreatedAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "autoCreatedAt"
    `);
  }
}
