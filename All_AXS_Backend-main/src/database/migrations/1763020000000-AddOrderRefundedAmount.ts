import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderRefundedAmount1763020000000 implements MigrationInterface {
  name = 'AddOrderRefundedAmount1763020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "refunded_amount_cents" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "refund_mode" character varying(16)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "refund_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "refunded_amount_cents"
    `);
  }
}
