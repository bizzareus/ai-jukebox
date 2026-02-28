import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Venue } from '../venues/venue.entity';
import { Song } from '../songs/song.entity';
import { Payment } from '../payments/payment.entity';

export enum QueueItemStatus {
  PENDING = 'pending',
  PLAYING = 'playing',
  PLAYED = 'played',
  SKIPPED = 'skipped',
}

@Entity('queue_items')
export class QueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_mobile', nullable: true })
  customerMobile: string;

  @Column({
    type: 'enum',
    enum: QueueItemStatus,
    default: QueueItemStatus.PENDING,
  })
  status: QueueItemStatus;

  @Column({ name: 'position', type: 'int' })
  position: number;

  @Column({ name: 'queued_at', type: 'timestamptz', default: () => 'NOW()' })
  queuedAt: Date;

  @Column({ name: 'played_at', nullable: true, type: 'timestamptz' })
  playedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
