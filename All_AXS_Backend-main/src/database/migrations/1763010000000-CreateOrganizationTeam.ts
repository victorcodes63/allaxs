import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationTeam1763010000000 implements MigrationInterface {
  name = 'CreateOrganizationTeam1763010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "org_member_role_enum" AS ENUM ('EDITOR', 'SCANNER')
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_members" (
        "id"                    UUID NOT NULL DEFAULT uuid_generate_v4(),
        "organizer_profile_id"  UUID NOT NULL,
        "user_id"               UUID NOT NULL,
        "role"                  "org_member_role_enum" NOT NULL,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_org_member_profile_user" UNIQUE ("organizer_profile_id", "user_id"),
        CONSTRAINT "FK_org_member_profile"
          FOREIGN KEY ("organizer_profile_id") REFERENCES "organizer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_org_member_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_org_members_profile" ON "organization_members" ("organizer_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_org_members_user" ON "organization_members" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_invites" (
        "id"                    UUID NOT NULL DEFAULT uuid_generate_v4(),
        "organizer_profile_id"  UUID NOT NULL,
        "email"                 VARCHAR(255) NOT NULL,
        "role"                  "org_member_role_enum" NOT NULL,
        "token"                 VARCHAR(64) NOT NULL,
        "invited_by_user_id"    UUID NOT NULL,
        "expires_at"            TIMESTAMPTZ NOT NULL,
        "accepted_at"           TIMESTAMPTZ NULL,
        "accepted_by_user_id"   UUID NULL,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_invites_token" UNIQUE ("token"),
        CONSTRAINT "FK_org_invite_profile"
          FOREIGN KEY ("organizer_profile_id") REFERENCES "organizer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_org_invite_inviter"
          FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_org_invites_profile" ON "organization_invites" ("organizer_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_org_invites_email" ON "organization_invites" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "org_member_role_enum"`);
  }
}
