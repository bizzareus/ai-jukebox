import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('gtm_leads')
export class GtmLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'place_id', nullable: true })
  placeId: string;

  @Column({ name: 'place_name', nullable: true })
  placeName: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  website: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'sent' })
  status: string;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
