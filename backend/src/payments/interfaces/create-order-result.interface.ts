import type { Song } from '../../songs/song.entity';
import type { Venue } from '../../venues/venue.entity';

export interface CreateOrderResult {
  orderId: string;
  paymentId: string;
  amount: number;
  upiString: string;
  /**
   * Canonical UPI intent (`upi://pay?...`) sourced from the Razorpay SDK
   * (QR `image_content`). Use for generic UPI / QR flows.
   */
  upiIntent?: string;
  /** GPay intent (`tez://pay?...`) derived from the Razorpay UPI string. */
  gpayIntent?: string;
  /** PhonePe intent (`phonepe://pay?...`) derived from the Razorpay UPI string. */
  phonepeIntent?: string;
  /** Paytm intent (`paytmmp://pay?...`) derived from the Razorpay UPI string. */
  paytmIntent?: string;
  qrImageUrl?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  song: Pick<Song, 'id' | 'title' | 'thumbnailUrl'>;
  venue: Pick<Venue, 'id' | 'name'>;
}
