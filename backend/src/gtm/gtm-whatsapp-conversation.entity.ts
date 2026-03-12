import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { GtmWhatsappMessage } from './gtm-whatsapp-message.entity';

@Entity('gtm_whatsapp_conversations')
export class GtmWhatsappConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** E.164 or national format; used as conversation key with WasenderAPI */
  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'bar_name', type: 'varchar', length: 500, nullable: true })
  barName: string | null;

  @Column({ name: 'created_by_admin_id', type: 'uuid', nullable: true })
  createdByAdminId: string | null;

  @Column({ name: 'onboarded_venue_id', type: 'uuid', nullable: true })
  onboardedVenueId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => GtmWhatsappMessage, (m) => m.conversation)
  messages: GtmWhatsappMessage[];
}
