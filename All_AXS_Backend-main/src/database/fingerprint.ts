/**
 * Database fingerprint utility
 * Prints current database name, user, and environment
 * Used for verification and debugging
 */

import * as dotenv from 'dotenv';
import { AppDataSource } from './data-source.factory';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

/**
 * Runs the database fingerprint check
 * Connects to the database and prints current database name, user, and environment
 */
export async function run(): Promise<void> {
  try {
    console.log('Connecting to database...');

    // Initialize DataSource if not already initialized
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Get current database name and user
    const result = (await AppDataSource.query(
      'SELECT current_database() as db, current_user as role',
    )) as unknown;
    const typedResult = result as Array<{ db: string; role: string }>;
    const firstResult = typedResult[0];
    const dbName = firstResult?.db;
    const dbUser = firstResult?.role;
    const env = process.env.NODE_ENV || 'development';

    if (!dbName || !dbUser) {
      throw new Error('Failed to get database information');
    }

    // Print fingerprint in the format: [DB] connected db=<name> user=<role> env=<NODE_ENV>
    console.log(`[DB] connected db=${dbName} user=${dbUser} env=${env}`);

    // Close connection
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error running database fingerprint:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
