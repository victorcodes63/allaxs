import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefundRequestsTable1763010000000
  implements MigrationInterface
{
  name = 'CreateRefundRequestsTable1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "refund_requests_status_enum" AS ENUM (
        'PENDING',
        'APPROVED',
        'DENIED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refund_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL,
        "user_id" uuid,
        "email" citext NOT NULL,
        "reason" text NOT NULL,
        "status" "refund_requests_status_enum" NOT NULL DEFAULT 'PENDING',
        "reviewed_at" TIMESTAMPTZ,
        "reviewed_by_user_id" uuid,
        "admin_note" text,
        CONSTRAINT "PK_refund_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refund_requests_order_id" UNIQUE ("order_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refund_requests_order_id" ON "refund_requests" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refund_requests_user_id" ON "refund_requests" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refund_requests_email" ON "refund_requests" ("email")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refund_requests_status" ON "refund_requests" ("status")
    `);

    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      ADD CONSTRAINT "FK_refund_requests_order_id"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      ADD CONSTRAINT "FK_refund_requests_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      ADD CONSTRAINT "FK_refund_requests_reviewed_by_user_id"
      FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      DROP CONSTRAINT "FK_refund_requests_reviewed_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      DROP CONSTRAINT "FK_refund_requests_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "refund_requests"
      DROP CONSTRAINT "FK_refund_requests_order_id"
    `);
    await queryRunner.query(`DROP INDEX "IDX_refund_requests_status"`);
    await queryRunner.query(`DROP INDEX "IDX_refund_requests_email"`);
    await queryRunner.query(`DROP INDEX "IDX_refund_requests_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_refund_requests_order_id"`);
    await queryRunner.query(`DROP TABLE "refund_requests"`);
    await queryRunner.query(`DROP TYPE "refund_requests_status_enum"`);
  }
}
