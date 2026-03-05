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

export enum PaymentStatus {
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({
    name: 'razorpay_qr_id',
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  razorpayQrId: string | null;

  @Column({
    name: 'razorpay_order_id',
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  razorpayOrderId: string | null;

  @Column({
    name: 'razorpay_payment_id',
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  razorpayPaymentId: string | null;

  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_mobile', nullable: true })
  customerMobile: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.CREATED,
  })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
