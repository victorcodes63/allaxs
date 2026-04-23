/**
 * Shared test setup utilities for E2E tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { cleanDatabase, seedTestUsers, SeededUsers } from './seed';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  moduleFixture: TestingModule;
}

/**
 * Create and initialize a test application with DataSource
 * Note: Migrations should be run in global-setup.ts before tests start
 */
export async function createTestApp(): Promise<TestApp> {
  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);

    // DataSource should already be initialized by NestJS TypeORM module
    // But ensure it's ready for use
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    return { app, dataSource, moduleFixture };
  } catch (error) {
    console.error('Error creating test app:', error);
    throw error;
  }
}

/**
 * Setup test app with seeded users
 */
export async function setupTestAppWithUsers(
  options: { includeOrganizer2?: boolean } = {},
): Promise<
  TestApp & { seededUsers: SeededUsers; moduleFixture: TestingModule }
> {
  const testApp = await createTestApp();

  // Clean database first
  await cleanDatabase(testApp.dataSource);

  // Seed test users
  const seededUsers = await seedTestUsers(testApp.dataSource, options);

  return { ...testApp, seededUsers };
}

/**
 * Destroy test app and close DataSource
 */
export async function destroyTestApp(testApp: TestApp): Promise<void> {
  if (testApp.dataSource.isInitialized) {
    await testApp.dataSource.destroy();
  }
  if (testApp.app) {
    await testApp.app.close();
  }
}
