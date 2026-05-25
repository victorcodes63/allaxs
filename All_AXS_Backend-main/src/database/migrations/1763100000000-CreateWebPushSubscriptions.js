/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/** @implements {MigrationInterface} */
module.exports = class CreateWebPushSubscriptions1763100000000 {
  name = 'CreateWebPushSubscriptions1763100000000';

  /** @param {QueryRunner} queryRunner */
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE "web_push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "userAgent" varchar(512),
        CONSTRAINT "PK_web_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_web_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_web_push_subscriptions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_web_push_subscriptions_userId" ON "web_push_subscriptions" ("userId")`,
    );
  }

  /** @param {QueryRunner} queryRunner */
  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "web_push_subscriptions"`);
  }
};
