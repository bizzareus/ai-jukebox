import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YtSearchResult {
  youtubeVideoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  thumbnailHqUrl: string;
  publishedAt: string;
}

export interface YtVideoMetadata extends YtSearchResult {
  durationSeconds: number;
  description: string;
  tags: string[];
  viewCount: number;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('YOUTUBE_API_KEY') as string;
  }

  async search(query: string, maxResults = 20): Promise<YtSearchResult[]> {
    this.logger.log(`YouTube search: "${query}"`);
    const { data } = await axios.get(`${YT_BASE}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults,
        key: this.apiKey,
      },
    });

    return (data.items || []).map((item: any) => ({
      youtubeVideoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      thumbnailUrl: item.snippet.thumbnails?.default?.url ?? '',
      thumbnailHqUrl:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        '',
      publishedAt: item.snippet.publishedAt,
    }));
  }

  async fetchMetadata(videoId: string): Promise<YtVideoMetadata | null> {
    this.logger.log(`Fetching YouTube metadata for videoId: ${videoId}`);
    const { data } = await axios.get(`${YT_BASE}/videos`, {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: this.apiKey,
      },
    });

    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const snippet = item.snippet;
    const details = item.contentDetails;
    const stats = item.statistics;

    return {
      youtubeVideoId: videoId,
      title: snippet.title,
      channelName: snippet.channelTitle,
      channelId: snippet.channelId,
      thumbnailUrl: snippet.thumbnails?.default?.url ?? '',
      thumbnailHqUrl:
        snippet.thumbnails?.maxres?.url ??
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        '',
      publishedAt: snippet.publishedAt,
      durationSeconds: this.parseDuration(details.duration),
      description: snippet.description ?? '',
      tags: snippet.tags ?? [],
      viewCount: parseInt(stats?.viewCount ?? '0', 10),
    };
  }

  /**
   * Fetch all video IDs from a YouTube playlist (handles pagination).
   * Playlist ID can be from URL e.g. ...list=PLxxx or just PLxxx.
   */
  async getPlaylistVideoIds(playlistId: string): Promise<string[]> {
    const id = this.normalizePlaylistId(playlistId);
    if (!id) {
      this.logger.warn(`Invalid playlist ID: ${playlistId}`);
      return [];
    }
    this.logger.log(`Fetching YouTube playlist items: ${id}`);
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await axios.get(`${YT_BASE}/playlistItems`, {
        params: {
          part: 'snippet',
          playlistId: id,
          maxResults: 50,
          key: this.apiKey,
          pageToken,
        },
      });
      for (const item of data.items ?? []) {
        const videoId = item.snippet?.resourceId?.videoId;
        const kind = item.snippet?.resourceId?.kind;
        if (videoId && kind === 'youtube#video') videoIds.push(videoId);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    this.logger.log(`Playlist ${id}: ${videoIds.length} video(s)`);
    return videoIds;
  }

  /** Extract playlist ID from URL (youtube.com or music.youtube.com) or return as-is if already ID (e.g. PL..., RDCL...). */
  private normalizePlaylistId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // Raw ID: PL... (standard) or RDCL... (YouTube Music) or similar
    if (/^[\w-]{10,}$/.test(trimmed)) return trimmed;
    // URL: youtube.com/playlist?list=... or music.youtube.com/playlist?list=...
    const match = trimmed.match(/[?&]list=([^&\s]+)/);
    return match ? match[1] : null;
  }

  /** Convert ISO 8601 duration (PT4M13S) to seconds */
  private parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? '0', 10);
    const minutes = parseInt(match[2] ?? '0', 10);
    const seconds = parseInt(match[3] ?? '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
}
