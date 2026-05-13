import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../app.module';
import { validateEnv } from '../common/env-validation';

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
    const parsed = new URL(rawUrl, 'https://internal.invalid');
    const bridged = parsed.searchParams.get('path');
    parsed.searchParams.delete('path');
    parsed.searchParams.delete('[...segments]');
    parsed.searchParams.delete('[[...segments]]');

    let url: string;
    if (bridged !== null) {
      let pathname = decodeURIComponent(bridged.replace(/\+/g, '%20'));
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        pathname = pathname.replace(/^\/api/, '') || '/';
      }
      const rest = parsed.searchParams.toString();
      url = rest === '' ? pathname : `${pathname}?${rest}`;
    } else {
      const pathOnly = parsed.pathname || '/';
      const search = parsed.search || '';
      const combined =
        search === '' ? pathOnly : `${pathOnly}${search}`;
      url =
        combined === '/api' || combined.startsWith('/api/')
          ? combined.replace(/^\/api/, '') || '/'
          : combined;
    }

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
