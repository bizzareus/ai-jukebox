import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { VenuesModule } from './venues/venues.module';
import { SongsModule } from './songs/songs.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queue/queue.module';
import { YoutubeModule } from './youtube/youtube.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GtmModule } from './gtm/gtm.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        if (databaseUrl && typeof databaseUrl === 'string') {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl: { rejectUnauthorized: false },
            // Use Supabase direct (db.*.supabase.co:5432) or session pooler (port 5432) for persistent backends like Railway
            extra: {
              statement_timeout: 30000,
              max: 10,
              connectionTimeoutMillis: 4000, // fail fast so we get more retries within healthcheck window
              prepare: false, // required for Supavisor transaction mode
            },
            autoLoadEntities: true,
            synchronize: false,
            logging: false,
            // Retry within healthcheck window (e.g. Railway 2m): more attempts so app can pass once DB is ready
            retryAttempts: 30,
            retryDelay: 2000,
          };
        }
        return {
          type: 'postgres' as const,
          host: String(config.get('DB_HOST') ?? 'localhost'),
          port: Number(config.get('DB_PORT')) || 5432,
          username: String(config.get('DB_USERNAME') ?? 'jukebox'),
          password: String(config.get('DB_PASSWORD') ?? 'jukebox_secret'),
          database: String(config.get('DB_NAME') ?? 'jukebox'),
          autoLoadEntities: true,
          synchronize: false,
          logging: false,
          retryAttempts: 30,
          retryDelay: 2000,
        };
      },
    }),
    AuthModule,
    VenuesModule,
    SongsModule,
    PlaylistsModule,
    PaymentsModule,
    QueueModule,
    YoutubeModule,
    NotificationsModule,
    GtmModule,
  ],
})
export class AppModule {}
