import type { Song } from '../../songs/song.entity';
import type { Venue } from '../../venues/venue.entity';

export interface CreateOrderResult {
  orderId: string;
  paymentId: string;
  amount: number;
  upiString: string;
  qrImageUrl?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  song: Pick<Song, 'id' | 'title' | 'thumbnailUrl'>;
  venue: Pick<Venue, 'id' | 'name'>;
}
