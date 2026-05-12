import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type { ServerResponse } from 'http';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { validateEnv } from './common/env-validation';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Validate environment variables at bootstrap
try {
  validateEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Don't throw on first error - return all validation errors
      stopAtFirstError: false,
    }),
  );

  // Local disk uploads are not usable on Vercel serverless; use STORAGE_DRIVER=spaces there.
  // Mount /static for the local driver — explicit, or the dev default when nothing is set.
  // Match StorageService.resolveDriverType() so the URL space and the driver always agree.
  const storageDriver =
    process.env.STORAGE_DRIVER ||
    (!process.env.VERCEL &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test'
      ? 'local'
      : 'stub');
  if (!process.env.VERCEL && storageDriver === 'local') {
    const uploadsDir = join(process.cwd(), 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    app.useStaticAssets(uploadsDir, {
      prefix: '/static',
      // helmet defaults to CORP: same-origin which would block <img src> from
      // localhost:3000 → localhost:8080. Posters are public assets — opt them
      // back out so cross-origin embeds (and next/image optimisation) work.
      setHeaders: (res: ServerResponse) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    });
  }

  const port = parseInt(process.env.PORT ?? '8080', 10);
  // Listen before Swagger: cold CPU + large OpenAPI graph can push startup past Cloud Run's probe window.
  // Cloud Run health checks target the container IP — bind all interfaces.
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`API listening on ${port}`);

  // Swagger/OpenAPI (after listen; skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    const config = new DocumentBuilder()
      .setTitle('All AXS API')
      .setDescription('All AXS Event Management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    SwaggerModule.setup('docs-json', app, document, {
      jsonDocumentUrl: '/docs-json',
    });
    app
      .get(Logger)
      .log(`Swagger docs available at http://localhost:${port}/docs`);
    app
      .get(Logger)
      .log(`Swagger JSON available at http://localhost:${port}/docs-json`);
  }
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
