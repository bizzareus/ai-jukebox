import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from './song.entity';
import { SongsService } from './songs.service';
import { SongsController } from './songs.controller';
import { YoutubeModule } from '../youtube/youtube.module';

@Module({
  imports: [TypeOrmModule.forFeature([Song]), YoutubeModule],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsModule {}
