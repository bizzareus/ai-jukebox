import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.warn('No DATABASE_URL or DB_HOST set — DB connection may fail.');
  }
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const allowedOrigins: string[] = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  )
    .split(',')
    .map((o: string) => o.trim())
    .filter((o): o is string => o.length > 0);
  // Muzobox's own web origins are always allowed, regardless of FRONTEND_URL
  // (covers direct cross-origin API calls from the hosted pay page, including
  // when it runs embedded in a partner-site iframe).
  const ALWAYS_ALLOWED_ORIGINS = [
    'https://muzobox.com',
    'https://www.muzobox.com',
  ];
  const isNgrokOrigin = (origin: string): boolean =>
    /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.ngrok\.io$/i.test(origin);
  type CorsCallback = (err: Error | null, allow?: boolean) => void;
  app.enableCors({
    origin: (origin: string | undefined, cb: CorsCallback): void => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (
        allowedOrigins.includes(origin) ||
        ALWAYS_ALLOWED_ORIGINS.includes(origin) ||
        isNgrokOrigin(origin)
      ) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // https://docs.nestjs.com/techniques/validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Jukebox API running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
