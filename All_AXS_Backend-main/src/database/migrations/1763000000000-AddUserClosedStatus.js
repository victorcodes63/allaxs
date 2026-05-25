/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/** @implements {MigrationInterface} */
module.exports = class AddUserClosedStatus1763000000000 {
  name = 'AddUserClosedStatus1763000000000';

  /** @param {QueryRunner} queryRunner */
  async up(queryRunner) {
    // PostgreSQL: new enum labels must be committed before use in the same migration.
    await queryRunner.commitTransaction();
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum" ADD VALUE IF NOT EXISTS 'CLOSED'`,
    );
    await queryRunner.startTransaction();

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `UPDATE "users"
       SET "status" = 'CLOSED',
           "closedAt" = COALESCE("closedAt", NOW())
       WHERE "status" = 'SUSPENDED'
         AND (
           "email" ILIKE '%@closed.allaxs.internal'
           OR "name" = 'Closed account'
         )`,
    );
  }

  /** @param {QueryRunner} queryRunner */
  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "closedAt"`);
    // PostgreSQL does not support removing enum values safely; leave CLOSED in enum.
  }
};
