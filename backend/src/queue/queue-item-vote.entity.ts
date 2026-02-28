import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { QueueItem } from './queue-item.entity';

@Entity('queue_item_votes')
export class QueueItemVote {
  @PrimaryColumn({ name: 'queue_item_id' })
  queueItemId: string;

  @ManyToOne(() => QueueItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_item_id' })
  queueItem: QueueItem;

  @PrimaryColumn({ name: 'session_id' })
  sessionId: string;
}
