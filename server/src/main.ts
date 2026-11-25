// Loads .env before anything else is imported, so module-level reads of process.env
// (FAST_DEMO, RESEND_API_KEY, ...) see the values. Keep this first.
import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // The Next.js UI usually calls the API through its own /api rewrite (same origin),
  // but allow direct browser calls too so NEXT_PUBLIC_API_URL can point straight here.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`API on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
