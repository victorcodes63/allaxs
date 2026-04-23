import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { DomainModule } from './domain/domain.module';
import { AdminModule } from './admin/admin.module';
import { OrganizersModule } from './organizers/organizers.module';
import { CheckoutModule } from './checkout/checkout.module';
import { HealthController } from './health.controller';
import { LoggerModule } from 'nestjs-pino';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisThrottlerStorage } from './common/redis-throttler-storage.service';
import { createTypeOrmConfig } from './database/typeorm-config.factory';
import { DbGuardService } from './database/db-guard.service';
import * as path from 'path';

// Conditionally load TestModule only in test environment
function getTestModule(): any[] {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_TEST_ROUTES === 'true'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const testModule = require('./test/test.module') as {
      TestModule: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return [testModule.TestModule];
  }
  return [];
}

// Conditionally load TestUtilsModule only in non-production
function getTestUtilsModule(): any[] {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const testUtilsModule = require('./test-utils/test-utils.module') as {
      TestUtilsModule: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return [testUtilsModule.TestUtilsModule];
  }
  return [];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load .env.test when NODE_ENV=test, otherwise .env
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? path.join(process.cwd(), '.env.test')
          : path.join(process.cwd(), '.env'),
      // Allow environment variables to override file values
      ignoreEnvFile: false,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60000), // 60 seconds
            limit: configService.get<number>('THROTTLE_LIMIT', 10), // 10 requests
          },
        ],
        storage: new RedisThrottlerStorage(configService),
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.PRETTY_LOGS === 'true'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.token',
          ],
          remove: true,
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        createTypeOrmConfig(configService),
      inject: [ConfigService],
    }),
    DomainModule,
    AuthModule,
    UsersModule,
    EventsModule,
    AdminModule,
    OrganizersModule,
    CheckoutModule,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    ...getTestModule(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    ...getTestUtilsModule(),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    DbGuardService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
