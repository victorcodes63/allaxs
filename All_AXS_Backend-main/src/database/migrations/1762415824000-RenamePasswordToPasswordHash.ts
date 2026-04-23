import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePasswordToPasswordHash1762415824000
  implements MigrationInterface
{
  name = 'RenamePasswordToPasswordHash1762415824000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename the 'password' column to 'passwordHash' in the users table
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: rename 'passwordHash' back to 'password'
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password"`,
    );
  }
}
