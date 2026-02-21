import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Venue } from '../venues/venue.entity';
import { PlaylistSong } from './playlist-song.entity';

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'venue_id', nullable: true })
  venueId: string | null;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue | null;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'cover_image_url', nullable: true })
  coverImageUrl: string;

  @OneToMany(() => PlaylistSong, (ps) => ps.playlist, { cascade: true })
  playlistSongs: PlaylistSong[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
