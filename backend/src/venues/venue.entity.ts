import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ name: 'upi_vpa' })
  upiVpa: string;

  @Column({ name: 'price_per_song', type: 'int', default: 100 })
  pricePerSong: number;

  /** Flat discount in same currency (₹). Final price = pricePerSong - discountAmount (min 1). */
  @Column({ name: 'discount_amount', type: 'int', default: 0 })
  discountAmount: number;

  @Column({ name: 'qr_code_url', nullable: true })
  qrCodeUrl: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({ name: 'cover_image_url', nullable: true })
  coverImageUrl: string;

  @Column({ name: 'theme_color', nullable: true, length: 50 })
  themeColor: string;

  @Column({ name: 'tagline', nullable: true, length: 255 })
  tagline: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'settings_json', type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
