/**
 * Example script for resetting test database
 * This script demonstrates how to use the guard utility to ensure
 * database operations only run on test databases
 * 
 * To use this script:
 * 1. Copy this file to reset-test-db.ts
 * 2. Implement your reset logic
 * 3. Run with: npm run reset-test-db (after adding script to package.json)
 */

import { assertTestDbOrDie } from './guardTestDb';
import { AppDataSource } from '../src/database/data-source.factory';

async function resetTestDatabase() {
  // GUARD: This must be called FIRST, before any database operations
  assertTestDbOrDie('reset');

  try {
    // Initialize DataSource
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    console.log('🔄 Resetting test database...');

    // Example: Drop all tables and re-run migrations
    // WARNING: This will delete all data in the test database
    await AppDataSource.dropDatabase();
    await AppDataSource.runMigrations();

    console.log('✅ Test database reset complete!');
  } catch (error) {
    console.error('❌ Error resetting test database:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run if called directly
if (require.main === module) {
  resetTestDatabase().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { resetTestDatabase };

