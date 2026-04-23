/**
 * DataSource factory that switches database connection based on NODE_ENV
 * - In test environment: uses DATABASE_URL_TEST (if set) or DB_* variables
 * - In other environments: uses DATABASE_URL if set, else DB_* (never DATABASE_URL_TEST)
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

/**
 * Asserts that the database name matches the expected environment
 * - In test: must be 'allaxs_test'
 * - In non-test: must NOT be 'allaxs_test'
 * @param dataSource - Connected DataSource instance
 * @throws Error if database name doesn't match environment expectations
 */
export async function assertDbMatchesEnv(
  dataSource: DataSource,
): Promise<void> {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before asserting DB name');
  }

  const result = (await dataSource.query(
    'SELECT current_database() as db',
  )) as unknown;
  const typedResult = result as Array<{ db: string }>;
  const firstResult = typedResult[0];
  const dbName = firstResult?.db;

  if (!dbName) {
    throw new Error('Failed to get current database name');
  }

  const isTest = process.env.NODE_ENV === 'test';

  if (isTest) {
    // Allow override via environment variable for CI/flexible test setups
    const expectedTestDb = process.env.EXPECTED_TEST_DB_NAME || 'allaxs_test';
    if (dbName !== expectedTestDb) {
      throw new Error(
        `Test environment requires database '${expectedTestDb}', but got '${dbName}'. ` +
          `Set DATABASE_URL_TEST to point to ${expectedTestDb} database, ` +
          `or set EXPECTED_TEST_DB_NAME to override the expected name.`,
      );
    }
  } else {
    if (dbName === 'allaxs_test') {
      throw new Error(
        `Non-test environment cannot use test database 'allaxs_test'. ` +
          `Current NODE_ENV=${process.env.NODE_ENV}. ` +
          `Ensure DB_NAME or DATABASE_URL points to a non-test database.`,
      );
    }
  }
}

/**
 * Creates DataSourceOptions based on the current environment
 * - Test: uses DATABASE_URL_TEST if set, else falls back to DB_* variables
 * - Non-test with DATABASE_URL: Neon / Vercel Postgres (CLI migrations)
 * - Non-test: uses DB_* variables only (never uses DATABASE_URL_TEST)
 */
export function makeDataSourceOptions(): DataSourceOptions {
  const isTest = process.env.NODE_ENV === 'test';
  const hasTestUrl = !!process.env.DATABASE_URL_TEST;
  const databaseUrl = process.env.DATABASE_URL;

  let options: DataSourceOptions;

  if (isTest && hasTestUrl) {
    // Test environment with DATABASE_URL_TEST
    options = {
      type: 'postgres',
      url: process.env.DATABASE_URL_TEST,
      ssl: false,
      synchronize: false,
      logging: false,
      entities: [path.join(__dirname, '/../**/*.entity.{ts,js}')],
      migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
    };
  } else if (!isTest && databaseUrl) {
    const isLocalPostgres =
      /@localhost[/:?\s]|@127\.0\.0\.1[/:?\s]/i.test(databaseUrl);
    options = {
      type: 'postgres',
      url: databaseUrl,
      ssl: isLocalPostgres ? false : { rejectUnauthorized: false },
      synchronize: false,
      logging: false,
      entities: [path.join(__dirname, '/../**/*.entity.{ts,js}')],
      migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
    };
  } else {
    // Non-test environment OR test without DATABASE_URL_TEST
    // Use individual connection parameters
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT || 5432);
    const database = process.env.DB_NAME;
    const username = process.env.DB_USER;
    const password = process.env.DB_PASS;

    if (!host || !database || !username || !password) {
      throw new Error(
        `Database configuration is incomplete. ` +
          `Provide DB_HOST, DB_NAME, DB_USER, DB_PASS` +
          (isTest ? `, or set DATABASE_URL_TEST for test environment.` : `.`),
      );
    }

    options = {
      type: 'postgres',
      host,
      port,
      database,
      username,
      password,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      synchronize: false,
      logging: false,
      entities: [path.join(__dirname, '/../**/*.entity.{ts,js}')],
      migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
    };
  }

  return options;
}

/**
 * AppDataSource instance created from the factory
 * This is the single source of truth for database connections
 */
export const AppDataSource = new DataSource(makeDataSourceOptions());
