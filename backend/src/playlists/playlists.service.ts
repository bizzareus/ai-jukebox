import {
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

  async create(venueId: string | null, dto: CreatePlaylistDto): Promise<Playlist> {
    const playlist = this.playlistRepository.create({ ...dto, venueId });
    const saved = await this.playlistRepository.save(playlist);
    this.logger.log(`Created playlist: ${saved.name}${venueId ? ` for venue ${venueId}` : ' (global)'}`);
    return saved;
  }

  async getOrCreateGlobalPlaylist(): Promise<Playlist> {
    let global = await this.playlistRepository.findOne({
      where: { venueId: IsNull(), name: GLOBAL_PLAYLIST_NAME },
      relations: ['playlistSongs', 'playlistSongs.song'],
    });
    if (!global) {
      global = await this.create(null, { name: GLOBAL_PLAYLIST_NAME, description: 'Songs added by super admin; venues can add these to their playlists.' });
      global = await this.findById(global.id);
    }
    return global!;
  }

  async findGlobalPlaylist(): Promise<Playlist | null> {
    return this.playlistRepository.findOne({
      where: { venueId: IsNull() },
      relations: ['playlistSongs', 'playlistSongs.song'],
    });
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

  async update(id: string, partial: Partial<CreatePlaylistDto>): Promise<Playlist> {
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
      throw new NotFoundException('Invalid YouTube URL. Use e.g. https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID');
    }
    await this.songsService.upsertFromYoutube(videoId);
    const global = await this.getOrCreateGlobalPlaylist();
    return this.addSong(global.id, { youtubeVideoId: videoId });
  }

  /** Super admin: remove a song from the global playlist by song id. */
  async removeSongFromGlobalPlaylist(songId: string): Promise<void> {
    const global = await this.getOrCreateGlobalPlaylist();
    await this.removeSong(global.id, songId);
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
