import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Venue } from '../venues/venue.entity';

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Venue admin subscriptions (notify when new song queued). */
  @Column({ name: 'venue_id', nullable: true })
  venueId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  /** Customer subscription for "notify when my song plays" (razorpay order id). */
  @Column({ name: 'order_id', nullable: true, unique: true })
  orderId: string;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ name: 'p256dh', type: 'text' })
  p256dh: string;

  @Column({ type: 'text' })
  auth: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
