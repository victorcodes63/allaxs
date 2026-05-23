import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPrefsAndInstallmentReminders1763030000000
  implements MigrationInterface
{
  name = 'AddNotificationPrefsAndInstallmentReminders1763030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_installments"
      ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_installments"
      DROP COLUMN IF EXISTS "last_reminder_sent_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "notification_prefs"
    `);
  }
}
