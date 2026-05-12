/**
 * TypeORM configuration factory for NestJS
 * Provides database configuration that switches based on NODE_ENV
 * Used by AppModule to configure TypeOrmModule
 * - In test environment: uses DATABASE_URL_TEST (if set) or DB_* variables
 * - In other environments: uses DATABASE_URL if set, else DB_* (never DATABASE_URL_TEST)
 */

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Creates TypeORM configuration options for NestJS
 * - Test: uses DATABASE_URL_TEST if set, else falls back to DB_* variables
 * - Non-test with DATABASE_URL: pooled URL (Neon, Vercel Postgres, etc.)
 * - Non-test: uses DB_* variables only (never uses DATABASE_URL_TEST)
 */
export function createTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isTest = configService.get<string>('NODE_ENV') === 'test';
  const hasTestUrl = !!configService.get<string>('DATABASE_URL_TEST');
  const databaseUrl = configService.get<string>('DATABASE_URL');

  if (isTest && hasTestUrl) {
    // Test environment with DATABASE_URL_TEST
    return {
      type: 'postgres',
      url: configService.get<string>('DATABASE_URL_TEST'),
      ssl: false,
      synchronize: false, // migrations only!
      autoLoadEntities: true,
      logging: false,
      connectTimeoutMS: 15_000,
      extra: {
        connectionTimeoutMillis: 15_000,
      },
    };
  }

  // Hosted Postgres (Neon, etc.): single connection string — SSL required off localhost
  if (!isTest && databaseUrl) {
    const isProd =
      configService.get<string>('NODE_ENV') === 'production';
    const isLocalPostgres =
      /@localhost[/:?\s]|@127\.0\.0\.1[/:?\s]/i.test(databaseUrl);
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: isLocalPostgres ? false : { rejectUnauthorized: false },
      synchronize: false, // migrations only!
      autoLoadEntities: true,
      logging: isProd ? ['error'] : ['error', 'schema'],
      connectTimeoutMS: 15_000,
      extra: {
        connectionTimeoutMillis: 15_000,
      },
    };
  }

  // Non-test environment OR test without DATABASE_URL_TEST
  // Use individual connection parameters
  const host = configService.get<string>('DB_HOST');
  const port = configService.get<number>('DB_PORT', 5432);
  const database = configService.get<string>('DB_NAME');
  const username = configService.get<string>('DB_USER');
  const password = configService.get<string>('DB_PASS');

  if (!host || !database || !username || !password) {
    throw new Error(
      `Database configuration is incomplete. ` +
        `Provide DB_HOST, DB_NAME, DB_USER, DB_PASS` +
        (isTest ? `, or set DATABASE_URL_TEST for test environment.` : `.`),
    );
  }

  return {
    type: 'postgres',
    host,
    port,
    database,
    username,
    password,
    ssl:
      configService.get<string>('NODE_ENV') === 'production'
        ? { rejectUnauthorized: false }
        : false,
    synchronize: false, // migrations only!
    autoLoadEntities: true,
    logging:
      configService.get<string>('NODE_ENV') === 'test'
        ? false
        : ['error', 'schema'],
    connectTimeoutMS: 15_000,
    extra: {
      connectionTimeoutMillis: 15_000,
    },
  };
}
