import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { Song } from '../songs/song.entity';

@Entity('playlist_songs')
export class PlaylistSong {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'playlist_id' })
  playlistId: string;

  @ManyToOne(() => Playlist, (p) => p.playlistSongs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
