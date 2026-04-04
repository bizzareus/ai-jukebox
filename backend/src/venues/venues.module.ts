import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './venue.entity';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';
import { PlaylistsModule } from '../playlists/playlists.module';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue]),
    PlaylistsModule,
    forwardRef(() => QueueModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [VenuesController],
  providers: [VenuesService],
  exports: [VenuesService],
})
export class VenuesModule {}
