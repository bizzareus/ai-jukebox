import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GtmWhatsappConversation } from './gtm-whatsapp-conversation.entity';

export type GtmWhatsappMessageDirection = 'in' | 'out';

@Entity('gtm_whatsapp_messages')
export class GtmWhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => GtmWhatsappConversation, (c) => c.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: GtmWhatsappConversation;

  @Column({ name: 'direction', type: 'varchar', length: 3 })
  direction: GtmWhatsappMessageDirection;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /** WasenderAPI message id for idempotency / reference */
  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string | null;

  @Column({
    name: 'is_ai_reply',
    type: 'boolean',
    default: false,
  })
  isAiReply: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
