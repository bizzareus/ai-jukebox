import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Song } from './song.entity';
import { YoutubeService } from '../youtube/youtube.service';

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    private readonly youtubeService: YoutubeService,
  ) {}

  async search(query: string) {
    return this.youtubeService.search(query);
  }

  /** Fetch full metadata from YouTube and upsert into songs table */
  async upsertFromYoutube(videoId: string): Promise<Song> {
    const existing = await this.songRepository.findOne({
      where: { youtubeVideoId: videoId },
    });

    const meta = await this.youtubeService.fetchMetadata(videoId);
    if (!meta) throw new NotFoundException(`YouTube video not found: ${videoId}`);

    const song = existing ?? this.songRepository.create();
    song.youtubeVideoId = meta.youtubeVideoId;
    song.title = meta.title;
    song.channelName = meta.channelName;
    song.channelId = meta.channelId;
    song.thumbnailUrl = meta.thumbnailUrl;
    song.thumbnailHqUrl = meta.thumbnailHqUrl;
    song.publishedAt = new Date(meta.publishedAt);
    song.durationSeconds = meta.durationSeconds;
    song.description = meta.description;
    song.tags = meta.tags;
    song.viewCount = meta.viewCount;
    song.cachedAt = new Date();

    const saved = await this.songRepository.save(song);
    this.logger.log(`Upserted song: ${saved.title} [${saved.youtubeVideoId}]`);
    return saved;
  }

  async findById(id: string): Promise<Song> {
    const song = await this.songRepository.findOne({ where: { id } });
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }

  async findByIds(ids: string[]): Promise<Song[]> {
    if (ids.length === 0) return [];
    return this.songRepository.find({ where: { id: In(ids) } });
  }

  async findByYoutubeId(youtubeVideoId: string): Promise<Song | null> {
    return this.songRepository.findOne({ where: { youtubeVideoId } });
  }
}
