export interface Song {
  id: string;
  youtubeVideoId: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  language?: string;
  thumbnailUrl?: string;
  thumbnailHqUrl?: string;
  durationSeconds: number;
  channelName?: string;
  tags?: string[];
  viewCount?: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  upiVpa: string;
  pricePerSong: number;
  /** Flat discount in ₹. Final price = pricePerSong - discountAmount (min 1). */
  discountAmount?: number;
  qrCodeUrl?: string;
  /** Venue branding (e.g. logo for QR overlay). */
  settings?: { logoUrl?: string };
}

export interface Playlist {
  id: string;
  venueId?: string | null;
  name: string;
  description?: string;
  coverImageUrl?: string;
  playlistSongs: PlaylistSong[];
}

export interface PlaylistSong {
  id: string;
  song: Song;
  sortOrder: number;
}

export const QueueItemStatus = {
  PENDING: 'pending',
  PLAYING: 'playing',
  PLAYED: 'played',
  SKIPPED: 'skipped',
} as const;
export type QueueItemStatus = (typeof QueueItemStatus)[keyof typeof QueueItemStatus];

export interface QueueItem {
  id: string;
  venueId: string;
  song: Song;
  customerName?: string;
  customerMobile?: string;
  status: QueueItemStatus;
  position: number;
  queuedAt: string;
  playedAt?: string;
  eta?: number;
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'venue_admin';
  venueId?: string;
  venue?: Venue;
}

export interface YtSearchResult {
  youtubeVideoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  thumbnailHqUrl: string;
  publishedAt: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  amount: number;
  upiString: string;
  /** True when using Razorpay test keys (rzp_test_*); show test UPI instructions */
  testMode?: boolean;
  /** Set in test mode only; use to open Razorpay Checkout for simulating UPI payment */
  razorpayKeyId?: string;
  song: Pick<Song, 'id' | 'title' | 'thumbnailUrl'>;
  venue: Pick<Venue, 'id' | 'name'>;
}
