import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1762416187000
  implements MigrationInterface
{
  name = 'CreateRefreshTokensTable1762416187000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "token" character varying(500) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ipAddress" character varying(45),
        "userAgent" text,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revokedReason" character varying(255),
        "replacedByToken" uuid,
        CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_6c8deae913e3f1e1c58d6ac46f0" UNIQUE ("token")
      )
    `);

    // Create index on userId for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_6c8deae913e3f1e1c58d6ac46f" ON "refresh_tokens" ("userId")
    `);

    // Create unique index on token
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_token_unique" ON "refresh_tokens" ("token")
    `);

    // Add foreign key constraint to users table
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "FK_6c8deae913e3f1e1c58d6ac46f0"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP CONSTRAINT "FK_6c8deae913e3f1e1c58d6ac46f0"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_token_unique"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_6c8deae913e3f1e1c58d6ac46f"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "refresh_tokens"
    `);
  }
}
