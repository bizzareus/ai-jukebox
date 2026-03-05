import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Playlist } from './playlist.entity';
import { PlaylistSong } from './playlist-song.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { SongsService } from '../songs/songs.service';
import { Song } from '../songs/song.entity';

export const GLOBAL_PLAYLIST_NAME = 'Global Library';

/** YouTube playlist IDs the Data API cannot list (Music/Radio mixes, Watch Later, etc.). */
const UNSUPPORTED_PLAYLIST_PREFIXES = ['RDCL', 'RDCM', 'HL', 'WL'];

function extractListId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]list=([^&\s]+)/);
  return match ? match[1] : trimmed;
}

function ensurePlaylistImportable(youtubePlaylistId: string): void {
  const listId = extractListId(youtubePlaylistId).toUpperCase();
  const prefix = UNSUPPORTED_PLAYLIST_PREFIXES.find((p) =>
    listId.startsWith(p),
  );
  if (prefix) {
    throw new BadRequestException(
      `This playlist type (${prefix}...) can't be imported. YouTube Music and Radio mixes, plus Watch Later/History, aren't supported by the YouTube API. Use a regular playlist link (URL with list=PL...) or create your own playlist and paste that link.`,
    );
  }
}

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistSong)
    private readonly playlistSongRepository: Repository<PlaylistSong>,
    private readonly songsService: SongsService,
  ) {}

  async create(
    venueId: string | null,
    dto: CreatePlaylistDto,
  ): Promise<Playlist> {
    const playlist = this.playlistRepository.create({ ...dto, venueId });
    const saved = await this.playlistRepository.save(playlist);
    this.logger.log(
      `Created playlist: ${saved.name}${venueId ? ` for venue ${venueId}` : ' (global)'}`,
    );
    return saved;
  }

  async getOrCreateGlobalPlaylist(): Promise<Playlist> {
    let global = await this.playlistRepository.findOne({
      where: { venueId: IsNull(), name: GLOBAL_PLAYLIST_NAME },
      relations: ['playlistSongs', 'playlistSongs.song'],
    });
    if (!global) {
      global = await this.create(null, {
        name: GLOBAL_PLAYLIST_NAME,
        description:
          'Songs added by super admin; venues can add these to their playlists.',
      });
      global = await this.findById(global.id);
    }
    return global;
  }

  async findGlobalPlaylist(): Promise<Playlist | null> {
    return this.playlistRepository.findOne({
      where: { venueId: IsNull(), name: GLOBAL_PLAYLIST_NAME },
      relations: ['playlistSongs', 'playlistSongs.song'],
    });
  }

  /** Super admin: list all global collections (playlists with no venue). */
  async findGlobalCollections(): Promise<Playlist[]> {
    return this.playlistRepository.find({
      where: { venueId: IsNull() },
      relations: ['playlistSongs', 'playlistSongs.song'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Super admin: create a new global collection. */
  async createGlobalCollection(dto: CreatePlaylistDto): Promise<Playlist> {
    return this.create(null, dto);
  }

  /** Add songs from a YouTube playlist to any playlist (e.g. a global collection). */
  async addSongsToPlaylistByYoutubePlaylistId(
    playlistId: string,
    youtubePlaylistId: string,
  ): Promise<{ added: number; skipped: number; errors: string[] }> {
    ensurePlaylistImportable(youtubePlaylistId);
    await this.findById(playlistId);
    const videoIds =
      await this.songsService.getPlaylistVideoIds(youtubePlaylistId);
    if (videoIds.length === 0) {
      throw new NotFoundException(
        'Playlist not found or has no videos. Use a playlist ID (e.g. PLxxx) or a URL with list=...',
      );
    }
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const videoId of videoIds) {
      try {
        await this.songsService.upsertFromYoutube(videoId);
        const hasSong = await this.playlistSongRepository
          .createQueryBuilder('ps')
          .innerJoin('ps.song', 's')
          .where('ps.playlistId = :playlistId', { playlistId })
          .andWhere('s.youtubeVideoId = :videoId', { videoId })
          .getOne();
        if (hasSong) {
          skipped += 1;
          continue;
        }
        await this.addSong(playlistId, { youtubeVideoId: videoId });
        added += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${videoId}: ${msg}`);
        this.logger.warn(`Failed to add video ${videoId}: ${msg}`);
      }
    }
    this.logger.log(
      `Playlist ${playlistId} import: ${added} added, ${skipped} skipped, ${errors.length} errors`,
    );
    return { added, skipped, errors };
  }

  /** Venue admin: import a global collection as a new playlist at the venue (copy name, description, and all songs). */
  async importGlobalCollectionToVenue(
    venueId: string,
    globalPlaylistId: string,
  ): Promise<Playlist> {
    const global = await this.findById(globalPlaylistId);
    if (global.venueId != null) {
      throw new NotFoundException('Playlist is not a global collection');
    }
    const newPlaylist = await this.create(venueId, {
      name: global.name,
      description: global.description ?? undefined,
      coverImageUrl: global.coverImageUrl ?? undefined,
    });
    const songs = (global.playlistSongs ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (let i = 0; i < songs.length; i++) {
      const ps = songs[i];
      if (ps.songId && ps.song) {
        try {
          await this.addSong(newPlaylist.id, {
            youtubeVideoId: ps.song.youtubeVideoId,
            sortOrder: i,
          });
        } catch (err) {
          this.logger.warn(
            `Skip copying song ${ps.songId} to venue playlist: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    this.logger.log(
      `Imported global collection "${global.name}" (${songs.length} songs) to venue ${venueId}`,
    );
    return this.findById(newPlaylist.id);
  }

  async findByVenue(venueId: string): Promise<Playlist[]> {
    return this.playlistRepository.find({
      where: { venueId },
      relations: ['playlistSongs', 'playlistSongs.song'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id },
      relations: ['playlistSongs', 'playlistSongs.song'],
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async addSong(playlistId: string, dto: AddSongDto): Promise<PlaylistSong> {
    const playlist = await this.findById(playlistId);

    // Upsert song metadata from YouTube
    const song = await this.songsService.upsertFromYoutube(dto.youtubeVideoId);

    const existing = await this.playlistSongRepository.findOne({
      where: { playlistId, songId: song.id },
    });
    if (existing) return existing;

    const maxOrder = playlist.playlistSongs?.length ?? 0;
    const ps = this.playlistSongRepository.create({
      playlistId,
      songId: song.id,
      sortOrder: dto.sortOrder ?? maxOrder,
    });

    const saved = await this.playlistSongRepository.save(ps);
    this.logger.log(`Added song ${song.title} to playlist ${playlistId}`);
    return saved;
  }

  async removeSong(playlistId: string, songId: string): Promise<void> {
    await this.playlistSongRepository.delete({ playlistId, songId });
  }

  async update(
    id: string,
    partial: Partial<CreatePlaylistDto>,
  ): Promise<Playlist> {
    await this.playlistRepository.update(id, partial);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.playlistRepository.delete(id);
  }

  /** Parse YouTube video ID from URL (youtube.com/watch?v=ID, youtu.be/ID, etc.). */
  private parseYoutubeVideoId(url: string): string | null {
    const trimmed = url.trim();
    const patterns = [
      /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  /** Super admin: add song to global playlist by pasting YouTube URL. */
  async addSongToGlobalByYoutubeUrl(youtubeUrl: string): Promise<PlaylistSong> {
    const videoId = this.parseYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      throw new NotFoundException(
        'Invalid YouTube URL. Use e.g. https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID',
      );
    }
    await this.songsService.upsertFromYoutube(videoId);
    const global = await this.getOrCreateGlobalPlaylist();
    return this.addSong(global.id, { youtubeVideoId: videoId });
  }

  /** Super admin: add song to a playlist (e.g. global collection) by YouTube URL. */
  async addSongToPlaylistByYoutubeUrl(
    playlistId: string,
    youtubeUrl: string,
  ): Promise<PlaylistSong> {
    const videoId = this.parseYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      throw new NotFoundException(
        'Invalid YouTube URL. Use e.g. https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID',
      );
    }
    await this.findById(playlistId);
    await this.songsService.upsertFromYoutube(videoId);
    return this.addSong(playlistId, { youtubeVideoId: videoId });
  }

  /** Super admin: remove a song from the global playlist by song id. */
  async removeSongFromGlobalPlaylist(songId: string): Promise<void> {
    const global = await this.getOrCreateGlobalPlaylist();
    await this.removeSong(global.id, songId);
  }

  /**
   * Super admin: fetch all videos from a YouTube playlist and add them to the global library.
   * Accepts playlist ID (e.g. PLxxx) or URL with list= parameter.
   */
  async addSongsToGlobalByPlaylistId(
    youtubePlaylistId: string,
  ): Promise<{ added: number; skipped: number; errors: string[] }> {
    ensurePlaylistImportable(youtubePlaylistId);
    const videoIds =
      await this.songsService.getPlaylistVideoIds(youtubePlaylistId);
    if (videoIds.length === 0) {
      throw new NotFoundException(
        'Playlist not found or has no videos. Use a playlist ID (e.g. PLxxx) or a URL with list=...',
      );
    }
    const global = await this.getOrCreateGlobalPlaylist();
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const videoId of videoIds) {
      try {
        await this.songsService.upsertFromYoutube(videoId);
        const hasSong = await this.playlistSongRepository
          .createQueryBuilder('ps')
          .innerJoin('ps.song', 's')
          .where('ps.playlistId = :playlistId', { playlistId: global.id })
          .andWhere('s.youtubeVideoId = :videoId', { videoId })
          .getOne();
        if (hasSong) {
          skipped += 1;
          continue;
        }
        await this.addSong(global.id, { youtubeVideoId: videoId });
        added += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${videoId}: ${msg}`);
        this.logger.warn(`Failed to add video ${videoId}: ${msg}`);
      }
    }
    this.logger.log(
      `Global playlist import: ${added} added, ${skipped} skipped, ${errors.length} errors`,
    );
    return { added, skipped, errors };
  }

  /** Songs in this venue's playlists, ordered by YouTube view count (most popular first). */
  async getPopularSongsForVenue(venueId: string, limit = 20): Promise<Song[]> {
    const rows = await this.playlistSongRepository
      .createQueryBuilder('ps')
      .innerJoinAndSelect('ps.song', 'song')
      .innerJoin('ps.playlist', 'p')
      .where('p.venue_id = :venueId', { venueId })
      .orderBy('song.view_count', 'DESC')
      .getMany();
    const seen = new Set<string>();
    const songs: Song[] = [];
    for (const row of rows) {
      if (row.song && !seen.has(row.song.id)) {
        seen.add(row.song.id);
        songs.push(row.song);
        if (songs.length >= limit) break;
      }
    }
    return songs;
  }
}
