/**
 * Shared test utilities for seeding test data
 */

import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { OrganizerProfile } from '../../src/users/entities/organizer-profile.entity';
import { Role } from '../../src/domain/enums';
import * as bcrypt from 'bcryptjs';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  roles: Role[];
}

export interface SeededUsers {
  admin: { user: User; profile?: OrganizerProfile };
  organizer: { user: User; profile: OrganizerProfile };
  attendee: { user: User; profile?: OrganizerProfile };
  organizer2?: { user: User; profile: OrganizerProfile };
}

export interface SeedOptions {
  includeOrganizer2?: boolean;
  organizer2Email?: string;
}

/**
 * Seed test users (admin, organizer, attendee)
 * Returns users and their IDs for use in tests
 */
export async function seedTestUsers(
  dataSource: DataSource,
  options: SeedOptions = {},
): Promise<SeededUsers> {
  const userRepository = dataSource.getRepository(User);
  const organizerProfileRepository = dataSource.getRepository(OrganizerProfile);

  // Default test users
  const testUsers: Record<string, TestUser> = {
    admin: {
      email: 'admin@example.com',
      password: 'Passw0rd!',
      name: 'Admin User',
      roles: [Role.ADMIN],
    },
    organizer: {
      email: 'org@example.com',
      password: 'Passw0rd!',
      name: 'Organizer User',
      roles: [Role.ORGANIZER],
    },
    attendee: {
      email: 'attendee@example.com',
      password: 'Passw0rd!',
      name: 'Attendee User',
      roles: [Role.ATTENDEE],
    },
  };

  if (options.includeOrganizer2) {
    testUsers.organizer2 = {
      email: options.organizer2Email || 'org2@example.com',
      password: 'Passw0rd!',
      name: 'Organizer User 2',
      roles: [Role.ORGANIZER],
    };
  }

  // Clean existing test users first (delete by email to avoid conflicts)
  const testEmails = Object.values(testUsers).map((u) => u.email);
  if (testEmails.length > 0) {
    // Delete organizer profiles for test users first (foreign key constraint)
    await organizerProfileRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (SELECT id FROM users WHERE email IN (:...emails))', {
        emails: testEmails,
      })
      .execute();

    // Delete test users
    await userRepository
      .createQueryBuilder()
      .delete()
      .where('email IN (:...emails)', { emails: testEmails })
      .execute();
  }

  // Create admin user
  const adminPasswordHash = await bcrypt.hash(testUsers.admin.password, 10);
  const adminUser = userRepository.create({
    email: testUsers.admin.email,
    passwordHash: adminPasswordHash,
    name: testUsers.admin.name,
    roles: testUsers.admin.roles,
  });
  const savedAdmin = await userRepository.save(adminUser);

  // Create organizer user
  const organizerPasswordHash = await bcrypt.hash(
    testUsers.organizer.password,
    10,
  );
  const organizerUser = userRepository.create({
    email: testUsers.organizer.email,
    passwordHash: organizerPasswordHash,
    name: testUsers.organizer.name,
    roles: testUsers.organizer.roles,
  });
  const savedOrganizer = await userRepository.save(organizerUser);

  // Create organizer profile
  const organizerProfile = organizerProfileRepository.create({
    userId: savedOrganizer.id,
    orgName: 'Test Organization',
    supportEmail: 'support@test.org',
  });
  const savedOrganizerProfile =
    await organizerProfileRepository.save(organizerProfile);

  // Create attendee user
  const attendeePasswordHash = await bcrypt.hash(
    testUsers.attendee.password,
    10,
  );
  const attendeeUser = userRepository.create({
    email: testUsers.attendee.email,
    passwordHash: attendeePasswordHash,
    name: testUsers.attendee.name,
    roles: testUsers.attendee.roles,
  });
  const savedAttendee = await userRepository.save(attendeeUser);

  const result: SeededUsers = {
    admin: { user: savedAdmin },
    organizer: { user: savedOrganizer, profile: savedOrganizerProfile },
    attendee: { user: savedAttendee },
  };

  // Create organizer2 if requested
  if (options.includeOrganizer2 && testUsers.organizer2) {
    const organizer2PasswordHash = await bcrypt.hash(
      testUsers.organizer2.password,
      10,
    );
    const organizer2User = userRepository.create({
      email: testUsers.organizer2.email,
      passwordHash: organizer2PasswordHash,
      name: testUsers.organizer2.name,
      roles: testUsers.organizer2.roles,
    });
    const savedOrganizer2 = await userRepository.save(organizer2User);

    const organizer2Profile = organizerProfileRepository.create({
      userId: savedOrganizer2.id,
      orgName: 'Test Organization 2',
      supportEmail: 'support2@test.org',
    });
    const savedOrganizer2Profile =
      await organizerProfileRepository.save(organizer2Profile);

    result.organizer2 = {
      user: savedOrganizer2,
      profile: savedOrganizer2Profile,
    };
  }

  return result;
}

/**
 * Clean all test data from database
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  // Use dynamic imports to avoid circular dependencies

  const RefreshToken =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/auth/entities/refresh-token.entity').RefreshToken;

  const AdminAuditLog =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/admin/entities/admin-audit-log.entity').AdminAuditLog;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Event = require('../../src/events/entities/event.entity').Event;

  const refreshTokenRepository = dataSource.getRepository(RefreshToken);
  const adminAuditLogRepository = dataSource.getRepository(AdminAuditLog);
  const eventRepository = dataSource.getRepository(Event);
  const organizerProfileRepository = dataSource.getRepository(OrganizerProfile);
  const userRepository = dataSource.getRepository(User);

  await refreshTokenRepository.createQueryBuilder().delete().execute();
  await adminAuditLogRepository.createQueryBuilder().delete().execute();
  await eventRepository.createQueryBuilder().delete().execute();
  await organizerProfileRepository.createQueryBuilder().delete().execute();
  await userRepository.createQueryBuilder().delete().execute();
}
