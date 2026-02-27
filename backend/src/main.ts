import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.warn('No DATABASE_URL or DB_HOST set — DB connection may fail.');
  }
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isNgrokOrigin = (origin: string) =>
    /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.ngrok\.io$/i.test(origin);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || isNgrokOrigin(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
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
