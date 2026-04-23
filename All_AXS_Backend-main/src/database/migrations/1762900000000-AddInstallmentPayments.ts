import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add installment payment support:
 * - Add allowInstallments and installmentConfig to ticket_types
 * - Add PARTIALLY_PAID to orders_status_enum (NOTE: This value is NOT used in code;
 *   payment progress is derived from PaymentPlan/Installments only)
 * - Create payment_plans table
 * - Create payment_installments table
 */
export class AddInstallmentPayments1762900000000 implements MigrationInterface {
  name = 'AddInstallmentPayments1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add PARTIALLY_PAID to orders_status_enum (for DB compatibility only;
    // code does NOT write this value - payment progress comes from PaymentPlan)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add installment fields to ticket_types
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      ADD COLUMN IF NOT EXISTS "allow_installments" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "installment_config" jsonb;
    `);

    // Create payment_plans table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "orderId" uuid NOT NULL,
        "ticketTypeId" uuid NOT NULL,
        "totalAmount" integer NOT NULL,
        "currency" character(3) NOT NULL DEFAULT 'KES',
        "status" character varying(32) NOT NULL DEFAULT 'ACTIVE',
        "nextDueAt" TIMESTAMP WITH TIME ZONE,
        "gracePeriodDays" integer,
        "autoCancelOnDefault" boolean NOT NULL DEFAULT false,
        "order_id" uuid,
        "ticket_type_id" uuid,
        CONSTRAINT "PK_payment_plans" PRIMARY KEY ("id")
      );
    `);

    // Create payment_installments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_installments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "planId" uuid NOT NULL,
        "sequence" integer NOT NULL,
        "amount" integer NOT NULL,
        "pct" numeric(5,2) NOT NULL,
        "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "paidAt" TIMESTAMP WITH TIME ZONE,
        "status" character varying(32) NOT NULL DEFAULT 'PENDING',
        "plan_id" uuid,
        CONSTRAINT "PK_payment_installments" PRIMARY KEY ("id")
      );
    `);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "payment_plans"
      ADD CONSTRAINT "FK_payment_plans_order"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
      ADD CONSTRAINT "FK_payment_plans_ticket_type"
        FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_installments"
      ADD CONSTRAINT "FK_payment_installments_plan"
        FOREIGN KEY ("plan_id") REFERENCES "payment_plans"("id") ON DELETE CASCADE;
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_plans_order" ON "payment_plans"("orderId");
      CREATE INDEX IF NOT EXISTS "IDX_payment_plans_ticket_type" ON "payment_plans"("ticketTypeId");
      CREATE INDEX IF NOT EXISTS "IDX_payment_plans_status" ON "payment_plans"("status");
      CREATE INDEX IF NOT EXISTS "IDX_payment_plans_next_due" ON "payment_plans"("nextDueAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_installments_plan" ON "payment_installments"("planId");
      CREATE INDEX IF NOT EXISTS "IDX_payment_installments_sequence" ON "payment_installments"("planId", "sequence");
      CREATE INDEX IF NOT EXISTS "IDX_payment_installments_status" ON "payment_installments"("status");
      CREATE INDEX IF NOT EXISTS "IDX_payment_installments_due" ON "payment_installments"("dueAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payment_installments_due";
      DROP INDEX IF EXISTS "IDX_payment_installments_status";
      DROP INDEX IF EXISTS "IDX_payment_installments_sequence";
      DROP INDEX IF EXISTS "IDX_payment_installments_plan";
      DROP INDEX IF EXISTS "IDX_payment_plans_next_due";
      DROP INDEX IF EXISTS "IDX_payment_plans_status";
      DROP INDEX IF EXISTS "IDX_payment_plans_ticket_type";
      DROP INDEX IF EXISTS "IDX_payment_plans_order";
    `);

    // Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "payment_installments"
      DROP CONSTRAINT IF EXISTS "FK_payment_installments_plan";
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_plans"
      DROP CONSTRAINT IF EXISTS "FK_payment_plans_ticket_type",
      DROP CONSTRAINT IF EXISTS "FK_payment_plans_order";
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_installments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_plans";`);

    // Remove columns from ticket_types
    await queryRunner.query(`
      ALTER TABLE "ticket_types"
      DROP COLUMN IF EXISTS "installment_config",
      DROP COLUMN IF EXISTS "allow_installments";
    `);

    // Note: We cannot easily remove PARTIALLY_PAID from the enum in PostgreSQL
    // This is a limitation - the enum value will remain but won't be used
    // In production, you may need to recreate the enum if this is critical
  }
}
