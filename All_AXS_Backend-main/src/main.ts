import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
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

  // Local disk uploads are not usable on Vercel serverless; use STORAGE_DRIVER=spaces (or stub).
  if (!process.env.VERCEL) {
    const uploadsDir = join(process.cwd(), 'uploads');
    app.useStaticAssets(uploadsDir, {
      prefix: '/static',
    });
  }

  // Swagger/OpenAPI setup (skip in test environment)
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
  }

  const port = parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);

  app.get(Logger).log(`API listening on ${port}`);
  if (process.env.NODE_ENV !== 'test') {
    app
      .get(Logger)
      .log(`Swagger docs available at http://localhost:${port}/docs`);
    app
      .get(Logger)
      .log(`Swagger JSON available at http://localhost:${port}/docs-json`);
  }
}

void bootstrap();
