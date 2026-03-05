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

  /**
   * Search by song name, artist, channel/singer. Searches our DB first (title, artist, channelName),
   * then YouTube, and merges results (deduped by youtubeVideoId).
   */
  async search(query: string) {
    const q = (query || '').trim();
    if (!q) return [];

    const seen = new Set<string>();
    const results: Array<{
      youtubeVideoId: string;
      title: string;
      channelName: string;
      thumbnailUrl: string;
      thumbnailHqUrl: string;
      publishedAt: string;
    }> = [];

    // 1) Search our DB: title, artist, channelName (full-text style)
    const term = `%${q.replace(/[%_]/g, (c) => (c === '%' ? '\\%' : '\\_'))}%`;
    const dbSongs = await this.songRepository
      .createQueryBuilder('s')
      .where(
        "LOWER(s.title) LIKE LOWER(:term) OR LOWER(COALESCE(s.artist, '')) LIKE LOWER(:term) OR LOWER(COALESCE(s.channelName, '')) LIKE LOWER(:term)",
        { term },
      )
      .orderBy('s.view_count', 'DESC')
      .take(20)
      .getMany();

    for (const song of dbSongs) {
      if (seen.has(song.youtubeVideoId)) continue;
      seen.add(song.youtubeVideoId);
      results.push({
        youtubeVideoId: song.youtubeVideoId,
        title: song.title,
        channelName: song.channelName ?? song.artist ?? '',
        thumbnailUrl: song.thumbnailUrl ?? '',
        thumbnailHqUrl: song.thumbnailHqUrl ?? song.thumbnailUrl ?? '',
        publishedAt: song.publishedAt?.toISOString?.() ?? '',
      });
    }

    // 2) YouTube search (same query – matches title, description, channel, etc.)
    const ytResults = await this.youtubeService.search(q, 20);
    for (const r of ytResults) {
      if (seen.has(r.youtubeVideoId)) continue;
      seen.add(r.youtubeVideoId);
      results.push({
        youtubeVideoId: r.youtubeVideoId,
        title: r.title,
        channelName: r.channelName,
        thumbnailUrl: r.thumbnailUrl,
        thumbnailHqUrl: r.thumbnailHqUrl,
        publishedAt: r.publishedAt,
      });
    }

    return results;
  }

  /** Fetch full metadata from YouTube and upsert into songs table. If song already exists in DB, return it without calling YouTube. */
  async upsertFromYoutube(videoId: string): Promise<Song> {
    const existing = await this.songRepository.findOne({
      where: { youtubeVideoId: videoId },
    });
    if (existing) {
      this.logger.debug(
        `Song already in DB: ${existing.title} [${videoId}], skipping YouTube fetch`,
      );
      return existing;
    }

    const meta = await this.youtubeService.fetchMetadata(videoId);
    if (!meta)
      throw new NotFoundException(`YouTube video not found: ${videoId}`);

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

  /** Get all video IDs from a YouTube playlist (for bulk import). */
  async getPlaylistVideoIds(playlistId: string): Promise<string[]> {
    return this.youtubeService.getPlaylistVideoIds(playlistId);
  }
}
