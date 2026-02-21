import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'youtube_video_id', unique: true })
  youtubeVideoId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  artist: string;

  @Column({ nullable: true })
  album: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  language: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'thumbnail_hq_url', nullable: true })
  thumbnailHqUrl: string;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'published_at', nullable: true, type: 'timestamptz' })
  publishedAt: Date;

  @Column({ name: 'channel_name', nullable: true })
  channelName: string;

  @Column({ name: 'channel_id', nullable: true })
  channelId: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'view_count', type: 'bigint', default: 0 })
  viewCount: number;

  @Column({ name: 'cached_at', nullable: true, type: 'timestamptz' })
  cachedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
