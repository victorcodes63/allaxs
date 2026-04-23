/**
 * Guard utility to prevent destructive operations on non-test databases
 * This ensures that reset, seed, and test operations only run against test databases
 * In test environment, requires exact database name 'allaxs_test'
 */

import { getDbNameFromUrl, getDbNameFromParams } from '../src/utils/db-name';

/**
 * Asserts that the current environment and database are safe for test operations
 * @param kind - Type of operation being performed ('reset', 'seed', or 'tests')
 * @throws Error if the environment or database is not safe for test operations
 */
export function assertTestDbOrDie(kind: 'reset' | 'seed' | 'tests'): void {
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (!isTestEnv) {
    throw new Error(
      `Refusing to ${kind} when NODE_ENV is not 'test' (got '${process.env.NODE_ENV}'). ` +
        `Set NODE_ENV=test to perform test operations.`,
    );
  }

  // Get database URL or individual parameters
  const databaseUrl = process.env.DATABASE_URL_TEST || '';
  const dbName = process.env.DB_NAME || '';

  let actualDbName: string;

  if (databaseUrl) {
    actualDbName = getDbNameFromUrl(databaseUrl);
  } else {
    actualDbName = getDbNameFromParams(dbName);
  }

  // In test environment, require exact database name 'allaxs_test'
  if (actualDbName !== 'allaxs_test') {
    throw new Error(
      `Refusing to ${kind} on non-test DB (db='${actualDbName}'). ` +
        `Test environment requires database name 'allaxs_test'. ` +
        `Set DATABASE_URL_TEST to point to allaxs_test database.`,
    );
  }

  // Log the database name for visibility (useful in test output)
  console.log(`[TEST DB GUARD] Operation '${kind}' allowed on database: ${actualDbName}`);
}

