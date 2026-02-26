import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { VenuesModule } from './venues/venues.module';
import { SongsModule } from './songs/songs.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queue/queue.module';
import { YoutubeModule } from './youtube/youtube.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
            // Supabase transaction-mode pooler (port 6543) doesn't support prepared statements
            extra: { statement_timeout: 30000 },
            autoLoadEntities: true,
            synchronize: false,
            logging: false,
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
  ],
})
export class AppModule {}
