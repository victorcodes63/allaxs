/**
 * Environment variable validation
 * Validates required env vars at bootstrap and provides clear error messages
 */

interface EnvConfig {
  // Required
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASS: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;

  // Optional with defaults
  PORT: number;
  NODE_ENV: string;
  REDIS_URL?: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;

  // Email
  EMAIL_PROVIDER: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  FRONTEND_URL?: string;

  // Storage (optional)
  STORAGE_DRIVER?: string;
  SPACES_ENDPOINT?: string;
  SPACES_REGION?: string;
  SPACES_BUCKET?: string;
  SPACES_ACCESS_KEY?: string;
  SPACES_SECRET_KEY?: string;
  CDN_BASE_URL?: string;
  UPLOAD_MAX_MB?: number;
  UPLOAD_ALLOWED_MIME?: string;
  STATIC_BASE_URL?: string;
}

export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Check if DATABASE_URL or DATABASE_URL_TEST is provided (alternative to individual params)
  const hasDatabaseUrl =
    process.env.DATABASE_URL || process.env.DATABASE_URL_TEST;

  // Required variables
  // If DATABASE_URL is provided, individual DB parameters are optional
  const required = {
    DB_HOST: hasDatabaseUrl
      ? process.env.DB_HOST || 'localhost'
      : process.env.DB_HOST,
    DB_PORT: hasDatabaseUrl
      ? process.env.DB_PORT || '5432'
      : process.env.DB_PORT,
    DB_NAME: hasDatabaseUrl
      ? process.env.DB_NAME || process.env.DB_NAME_TEST || 'default'
      : process.env.DB_NAME,
    DB_USER: hasDatabaseUrl
      ? process.env.DB_USER || 'default'
      : process.env.DB_USER,
    DB_PASS: hasDatabaseUrl
      ? process.env.DB_PASS || 'default'
      : process.env.DB_PASS,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // Only validate individual DB parameters if DATABASE_URL is not provided
  if (!hasDatabaseUrl) {
    for (const [key, value] of Object.entries(required)) {
      if (key.startsWith('DB_') && !value) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }
  }

  // JWT secrets are always required
  if (!required.JWT_SECRET) {
    errors.push('Missing required environment variable: JWT_SECRET');
  }
  if (!required.JWT_REFRESH_SECRET) {
    errors.push('Missing required environment variable: JWT_REFRESH_SECRET');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\nPlease check your .env file or environment variables.`,
    );
  }

  // Validate email provider if set
  const emailProvider = process.env.EMAIL_PROVIDER || 'resend';
  if (emailProvider === 'resend') {
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'test') {
      errors.push(
        'RESEND_API_KEY is required when EMAIL_PROVIDER=resend (unless NODE_ENV=test)',
      );
    }
    if (!process.env.RESEND_FROM && process.env.NODE_ENV !== 'test') {
      errors.push(
        'RESEND_FROM is required when EMAIL_PROVIDER=resend (unless NODE_ENV=test)',
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\nPlease check your .env file or environment variables.`,
    );
  }

  return {
    // Required
    DB_HOST: required.DB_HOST!,
    DB_PORT: parseInt(required.DB_PORT!, 10),
    DB_NAME: required.DB_NAME!,
    DB_USER: required.DB_USER!,
    DB_PASS: required.DB_PASS!,
    JWT_SECRET: required.JWT_SECRET!,
    JWT_REFRESH_SECRET: required.JWT_REFRESH_SECRET!,

    // Optional with defaults
    PORT: parseInt(process.env.PORT || '8080', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    REDIS_URL: process.env.REDIS_URL,
    THROTTLE_TTL: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    THROTTLE_LIMIT: parseInt(process.env.THROTTLE_LIMIT || '10', 10),

    // Email
    EMAIL_PROVIDER: emailProvider,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Storage (optional)
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'stub',
    SPACES_ENDPOINT: process.env.SPACES_ENDPOINT,
    SPACES_REGION: process.env.SPACES_REGION,
    SPACES_BUCKET: process.env.SPACES_BUCKET,
    SPACES_ACCESS_KEY: process.env.SPACES_ACCESS_KEY,
    SPACES_SECRET_KEY: process.env.SPACES_SECRET_KEY,
    CDN_BASE_URL: process.env.CDN_BASE_URL,
    UPLOAD_MAX_MB: parseInt(process.env.UPLOAD_MAX_MB || '10', 10),
    UPLOAD_ALLOWED_MIME: process.env.UPLOAD_ALLOWED_MIME,
    STATIC_BASE_URL: process.env.STATIC_BASE_URL || '/static',
  };
}
