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

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  VENUE_ADMIN = 'venue_admin',
}

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.VENUE_ADMIN })
  role: AdminRole;

  @Column({ name: 'venue_id', nullable: true })
  venueId: string;

  @ManyToOne(() => Venue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
