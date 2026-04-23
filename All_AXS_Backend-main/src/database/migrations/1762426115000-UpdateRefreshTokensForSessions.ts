import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRefreshTokensForSessions1762426115000
  implements MigrationInterface
{
  name = 'UpdateRefreshTokensForSessions1762426115000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename 'token' column to 'tokenHash'
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" 
      RENAME COLUMN "token" TO "tokenHash"
    `);

    // Add 'usedAt' column for rotation tracking
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN "usedAt" TIMESTAMP WITH TIME ZONE
    `);

    // Add 'deviceId' column for device fingerprinting
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN "deviceId" VARCHAR(128)
    `);

    // Update index name to reflect column rename
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_token_unique"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_tokenHash_unique" 
      ON "refresh_tokens" ("tokenHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tokenHash_unique"
    `);

    // Recreate old index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_token_unique" 
      ON "refresh_tokens" ("tokenHash")
    `);

    // Remove deviceId column
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN IF EXISTS "deviceId"
    `);

    // Remove usedAt column
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN IF EXISTS "usedAt"
    `);

    // Rename tokenHash back to token
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      RENAME COLUMN "tokenHash" TO "token"
    `);
  }
}
