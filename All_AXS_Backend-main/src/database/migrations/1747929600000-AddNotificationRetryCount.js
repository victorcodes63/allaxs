/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/** @implements {MigrationInterface} */
module.exports = class AddNotificationRetryCount1747929600000 {
  name = 'AddNotificationRetryCount1747929600000';

  /** @param {QueryRunner} queryRunner */
  async up(queryRunner) {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "retryCount" integer NOT NULL DEFAULT 0`,
    );
  }

  /** @param {QueryRunner} queryRunner */
  async down(queryRunner) {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "retryCount"`,
    );
  }
};
