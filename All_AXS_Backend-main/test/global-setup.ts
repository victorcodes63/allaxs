/**
 * Jest global setup
 * Ensures that tests only run against test databases
 * Loads .env.test and validates database configuration
 * Ensures required extensions and runs pending migrations only (no drop/truncate)
 */

// Register tsconfig-paths to resolve 'src/*' imports at runtime
import 'tsconfig-paths/register';

import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  AppDataSource,
  assertDbMatchesEnv,
} from '../src/database/data-source.factory';

export default async function globalSetup(): Promise<void> {
  // Load .env.test file
  const envPath = path.join(process.cwd(), '.env.test');
  dotenv.config({ path: envPath });

  // Ensure NODE_ENV is set to test
  process.env.NODE_ENV = 'test';

  console.log('[JEST GLOBAL SETUP] Initializing test database connection...');

  try {
    // Initialize DataSource (creates connection if not already initialized)
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Verify we are connected to allaxs_test database
    await assertDbMatchesEnv(AppDataSource);

    // Get current database name and user for logging
    const dbInfo = await AppDataSource.query(
      'SELECT current_database() as db, current_user as role',
    );
    const dbName = dbInfo[0]?.db;
    const dbUser = dbInfo[0]?.role;

    console.log(
      `[JEST GLOBAL SETUP] Connected to database: ${dbName} as user: ${dbUser}`,
    );
    console.log(
      `[JEST GLOBAL SETUP] Using DB allaxs_test (persistent - no drop/truncate)`,
    );

    // Ensure required PostgreSQL extensions exist
    console.log('[JEST GLOBAL SETUP] Ensuring required extensions...');
    await AppDataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await AppDataSource.query('CREATE EXTENSION IF NOT EXISTS "citext"');
    console.log('[JEST GLOBAL SETUP] Extensions verified');

    // Run pending migrations only (no drop/truncate)
    console.log('[JEST GLOBAL SETUP] Running pending migrations...');
    await AppDataSource.runMigrations();
    console.log('[JEST GLOBAL SETUP] Migrations completed successfully');

    // Close connection (NestJS will create its own connection when tests run)
    await AppDataSource.destroy();
    console.log('[JEST GLOBAL SETUP] Setup completed successfully');
  } catch (error: any) {
    console.error('[JEST GLOBAL SETUP] Error during setup:', error.message);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    throw new Error(
      `Failed to setup test database: ${error instanceof Error ? error.message : String(error)}\n` +
        `Make sure:\n` +
        `1. DATABASE_URL_TEST is set in .env.test pointing to allaxs_test database\n` +
        `2. The test database 'allaxs_test' exists\n` +
        `3. You have permission to create tables and extensions\n` +
        `4. Run migrations manually to debug: npm run migrate:run:test`,
    );
  }
}
