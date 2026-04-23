import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailVerificationsAndPasswordResetsTables1762432000000
  implements MigrationInterface
{
  name = 'CreateEmailVerificationsAndPasswordResetsTables1762432000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create email_verifications table
    await queryRunner.query(`
      CREATE TABLE "email_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "token" character varying(64) NOT NULL,
        "email" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isUsed" boolean NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_email_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for email_verifications
    await queryRunner.query(`
      CREATE INDEX "IDX_email_verifications_userId" ON "email_verifications" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_email_verifications_token" ON "email_verifications" ("token")
    `);

    // Add foreign key constraint for email_verifications
    await queryRunner.query(`
      ALTER TABLE "email_verifications"
      ADD CONSTRAINT "FK_email_verifications_userId"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    // Create password_resets table
    await queryRunner.query(`
      CREATE TABLE "password_resets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "token" character varying(64) NOT NULL,
        "email" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isUsed" boolean NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "ipAddress" character varying(45),
        CONSTRAINT "PK_password_resets" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for password_resets
    await queryRunner.query(`
      CREATE INDEX "IDX_password_resets_userId" ON "password_resets" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_password_resets_token" ON "password_resets" ("token")
    `);

    // Add foreign key constraint for password_resets
    await queryRunner.query(`
      ALTER TABLE "password_resets"
      ADD CONSTRAINT "FK_password_resets_userId"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "password_resets"
      DROP CONSTRAINT "FK_password_resets_userId"
    `);

    await queryRunner.query(`
      ALTER TABLE "email_verifications"
      DROP CONSTRAINT "FK_email_verifications_userId"
    `);

    // Drop indexes for password_resets
    await queryRunner.query(`
      DROP INDEX "IDX_password_resets_token"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_password_resets_userId"
    `);

    // Drop indexes for email_verifications
    await queryRunner.query(`
      DROP INDEX "IDX_email_verifications_token"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_email_verifications_userId"
    `);

    // Drop tables
    await queryRunner.query(`
      DROP TABLE "password_resets"
    `);

    await queryRunner.query(`
      DROP TABLE "email_verifications"
    `);
  }
}
