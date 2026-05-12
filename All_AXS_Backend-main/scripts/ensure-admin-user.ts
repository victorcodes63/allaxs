/**
 * Create a user with ADMIN (and ATTENDEE) or grant ADMIN on an existing row.
 *
 * Usage (from API repo root):
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='your-secret' npm run ensure-admin-user
 *
 * If the user does not exist, BOOTSTRAP_ADMIN_PASSWORD is required.
 * If the user exists, password is optional (omit to keep current password; only roles are updated).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/database/data-source.factory';
import { User } from '../src/users/entities/user.entity';
import { Role, UserStatus } from '../src/domain/enums';

async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env') });

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.error('Set BOOTSTRAP_ADMIN_EMAIL');
    process.exit(1);
  }

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName =
    (process.env.BOOTSTRAP_ADMIN_NAME || 'Admin').trim() || 'Admin';

  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);

  const existing = await users.findOne({ where: { email } });

  if (!existing) {
    if (!password) {
      console.error(
        'User not found. Set BOOTSTRAP_ADMIN_PASSWORD to create the account.',
      );
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await users.save(
      users.create({
        email,
        name: displayName,
        passwordHash,
        roles: [Role.ADMIN, Role.ATTENDEE],
        status: UserStatus.ACTIVE,
      }),
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'created',
          id: created.id,
          email: created.email,
          roles: created.roles,
        },
        null,
        2,
      ),
    );
    await AppDataSource.destroy();
    return;
  }

  let updated = false;
  const nextRoles = new Set<Role>(existing.roles ?? []);
  if (!nextRoles.has(Role.ADMIN)) {
    nextRoles.add(Role.ADMIN);
    updated = true;
  }
  if (!nextRoles.has(Role.ATTENDEE)) {
    nextRoles.add(Role.ATTENDEE);
    updated = true;
  }
  existing.roles = Array.from(nextRoles);

  if (password) {
    existing.passwordHash = await bcrypt.hash(password, 10);
    updated = true;
  }

  if (displayName && existing.name !== displayName) {
    existing.name = displayName;
    updated = true;
  }

  if (updated) {
    await users.save(existing);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: updated ? 'updated' : 'unchanged',
        id: existing.id,
        email: existing.email,
        roles: existing.roles,
        passwordChanged: Boolean(password),
      },
      null,
      2,
    ),
  );

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
