import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminAuditLogsTable1762430000000
  implements MigrationInterface
{
  name = 'CreateAdminAuditLogsTable1762430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create admin_audit_logs table
    await queryRunner.query(`
      CREATE TABLE "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "admin_user_id" uuid,
        "action" character varying(64) NOT NULL,
        "resource_type" character varying(64) NOT NULL,
        "resource_id" character varying(255),
        "metadata" jsonb,
        "ip_address" character varying(45),
        "user_agent" text,
        "status" character varying(32) NOT NULL DEFAULT 'SUCCESS',
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_logs_admin_user_id" 
      ON "admin_audit_logs" ("admin_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_logs_action" 
      ON "admin_audit_logs" ("action")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_logs_resource_type" 
      ON "admin_audit_logs" ("resource_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_logs_resource_id" 
      ON "admin_audit_logs" ("resource_id")
    `);

    // Add foreign key constraint to users table
    await queryRunner.query(`
      ALTER TABLE "admin_audit_logs"
      ADD CONSTRAINT "FK_admin_audit_logs_admin_user_id"
      FOREIGN KEY ("admin_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "admin_audit_logs"
      DROP CONSTRAINT "FK_admin_audit_logs_admin_user_id"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_admin_audit_logs_resource_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_admin_audit_logs_resource_type"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_admin_audit_logs_action"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_admin_audit_logs_admin_user_id"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "admin_audit_logs"
    `);
  }
}
