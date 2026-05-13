import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/common/env-validation';

let cachedHandler:
  | ((req: VercelRequest, res: VercelResponse) => Promise<void> | void)
  | null = null;

async function createHandler() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    }),
  );

  await app.init();

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

  const expressApp = app.getHttpAdapter().getInstance();

  return (req: VercelRequest, res: VercelResponse) => {
    const rawUrl = req.url ?? '/';
    const q = rawUrl.indexOf('?');
    const pathOnly = q === -1 ? rawUrl : rawUrl.slice(0, q);
    const search = q === -1 ? '' : rawUrl.slice(q);
    // Optional catch-all routes add this query key; Express/Nest would otherwise see a bogus path.
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    sp.delete('[...segments]');
    const rest = sp.toString();
    const withoutCatchAllQuery =
      rest === '' ? pathOnly : `${pathOnly}?${rest}`;
    // Vercel mounts this file under /api/... ; Nest routes have no /api prefix.
    const url =
      withoutCatchAllQuery === '/api' ||
      withoutCatchAllQuery.startsWith('/api/')
        ? withoutCatchAllQuery.replace(/^\/api/, '') || '/'
        : withoutCatchAllQuery;
    (req as { url?: string }).url = url;
    return expressApp(req as any, res as any);
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!cachedHandler) {
    cachedHandler = await createHandler();
  }
  return cachedHandler(req, res);
}
