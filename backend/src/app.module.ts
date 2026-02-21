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
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'jukebox'),
        password: config.get('DB_PASSWORD', 'jukebox_secret'),
        database: config.get('DB_NAME', 'jukebox'),
        autoLoadEntities: true,
        synchronize: false, // schema managed by scripts/init-db.sql
        logging: false,
      }),
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
