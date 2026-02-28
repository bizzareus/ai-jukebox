import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueItem } from './queue-item.entity';
import { QueueItemVote } from './queue-item-vote.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueueGateway } from './queue.gateway';
import { Payment } from '../payments/payment.entity';
import { PlaylistsModule } from '../playlists/playlists.module';
import { SongsModule } from '../songs/songs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Venue } from '../venues/venue.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueItem, QueueItemVote, Payment, Venue]),
    PlaylistsModule,
    SongsModule,
    NotificationsModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueGateway],
  exports: [QueueService, QueueGateway],
})
export class QueueModule {}
