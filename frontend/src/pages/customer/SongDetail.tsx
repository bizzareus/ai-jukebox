import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, IndianRupee, ListMusic } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { UpiPaymentSheet, type QueueConfirmPayload } from '../../components/UpiPaymentSheet';
import type { Song, Venue, CreateOrderResponse } from '../../types';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const STORAGE_KEY_NAME = 'jukebox_customer_name';
const STORAGE_KEY_MOBILE = 'jukebox_customer_mobile';

interface FreeQueueResponse {
  queueItem: { id: string; position: number };
  position: number;
  eta: number;
}

export default function SongDetail() {
  const { slug, songId } = useParams<{ slug: string; songId: string }>();
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const venueIdFromQuery = searchParams.get('venueId') ?? '';

  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submittedCustomerName, setSubmittedCustomerName] = useState('');
  const [submittedCustomerMobile, setSubmittedCustomerMobile] = useState('');

  const [freeSheetOpen, setFreeSheetOpen] = useState(false);
  const [freeFormName, setFreeFormName] = useState('');
  const [freeFormMobile, setFreeFormMobile] = useState('');
  const [freeSubmitting, setFreeSubmitting] = useState(false);

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ['venue', slug],
    queryFn: () => api.get<Venue>(`/venues/${slug}`),
    enabled: !!slug,
  });

  const { data: song } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn: () => api.get<Song>(`/songs/${songId}`),
    enabled: !!songId && !state?.song?.durationSeconds,
    initialData: state?.song?.durationSeconds ? (state.song as Song) : undefined,
  });

  const venueId = venue?.id ?? venueIdFromQuery;
  const freeQueue = venue?.pricingEnabled === false;

  useEffect(() => {
    if (!freeSheetOpen) return;
    setFreeFormName(localStorage.getItem(STORAGE_KEY_NAME) ?? '');
    setFreeFormMobile(localStorage.getItem(STORAGE_KEY_MOBILE) ?? '');
  }, [freeSheetOpen]);

  const handleOpenPayment = () => {
    if (!song || !venueId) return;
    setOrder(null);
    setPaymentOpen(true);
  };

  const handleOpenFreeSheet = () => {
    if (!song || !venueId) return;
    setFreeSheetOpen(true);
  };

  const handleCreateOrder = async (customerName: string, customerMobile: string) => {
    if (!song || !venueId) throw new Error('Missing song or venue');
    const res = await api.post<CreateOrderResponse>('/payments/create-order', {
      songId: song.id ?? songId,
      venueId,
      customerName: customerName.trim() || undefined,
      customerMobile: customerMobile.trim() || undefined,
    });
    setSubmittedCustomerName(customerName);
    setSubmittedCustomerMobile(customerMobile);
    setOrder(res);
    return res;
  };

  const handleFreeSubmit = async () => {
    if (!song || !venueId || !freeFormName.trim() || freeFormMobile.trim().length < 10) return;
    localStorage.setItem(STORAGE_KEY_NAME, freeFormName.trim());
    localStorage.setItem(STORAGE_KEY_MOBILE, freeFormMobile.trim());
    setFreeSubmitting(true);
    try {
      const res = await api.post<FreeQueueResponse>('/queue/free-request', {
        songId: song.id ?? songId,
        venueId,
        customerName: freeFormName.trim(),
        customerMobile: freeFormMobile.trim(),
      });
      setFreeSheetOpen(false);
      const payload: QueueConfirmPayload = {
        queueItem: res.queueItem,
        position: res.position,
        eta: res.eta,
      };
      navigate(`/${slug}/queue`, {
        state: { confirmedItem: payload, venueId },
      });
    } finally {
      setFreeSubmitting(false);
    }
  };

  const handleSuccess = (data: QueueConfirmPayload) => {
    setPaymentOpen(false);
    navigate(`/${slug}/queue`, {
      state: { confirmedItem: data, venueId },
    });
  };

  const displaySong = song ?? (state?.song as Song | undefined);

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero */}
      <div className="relative">
        <div className="h-64 bg-gradient-to-b from-brand-900/30 to-surface overflow-hidden">
          {displaySong?.thumbnailHqUrl && (
            <img
              src={displaySong.thumbnailHqUrl}
              alt={displaySong?.title}
              className="w-full h-full object-cover opacity-25"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-10 left-4 p-2 rounded-full bg-white/90 backdrop-blur-sm text-stone-900 shadow-md"
          title="Go back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {displaySong?.thumbnailHqUrl && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <img
              src={displaySong.thumbnailHqUrl}
              alt={displaySong?.title}
              className="w-28 h-28 rounded-2xl object-cover shadow-xl shadow-stone-900/20 border-2 border-white"
            />
          </div>
        )}
      </div>

      <div className="px-5 pt-16 pb-10">
        {!displaySong ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold text-stone-900 leading-tight">
                {displaySong.title}
              </h1>
              <p className="text-stone-500 mt-1">{displaySong.artist ?? displaySong.channelName}</p>
              {displaySong.durationSeconds > 0 && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-stone-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm">{formatDuration(displaySong.durationSeconds)}</span>
                </div>
              )}
              {displaySong.genre && (
                <span className="inline-block mt-2 px-3 py-1 bg-stone-100 rounded-full text-xs text-stone-600">
                  {displaySong.genre}
                </span>
              )}
            </div>

            {/* Pay / free queue CTA */}
            <div className="bg-surface-card rounded-2xl border border-surface-border shadow-sm p-4 mb-4">
              {venueLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : freeQueue ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-stone-600 text-sm">Song play</span>
                    <span className="text-stone-900 text-sm font-semibold">Free queue</span>
                  </div>
                  <p className="text-stone-500 text-xs mb-4">
                    Add this song to the queue at {venue?.name}
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleOpenFreeSheet}
                  >
                    <ListMusic className="w-4 h-4" />
                    Add to queue
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-stone-600 text-sm">Song play</span>
                    <div className="flex items-center gap-1 text-stone-900 font-bold">
                      <IndianRupee className="w-4 h-4 text-brand-600" />
                      {venue?.discountAmount ? (
                        <>
                          <span className="line-through text-stone-400 text-base">{venue.pricePerSong ?? 100}</span>
                          <span className="text-lg text-brand-600">₹{Math.max(1, (venue.pricePerSong ?? 100) - venue.discountAmount)}</span>
                        </>
                      ) : (
                        <span className="text-lg">₹{venue?.pricePerSong ?? 100}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-stone-500 text-xs mb-4">
                    Pay via UPI · Payment goes directly to {venue?.name}
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleOpenPayment}
                  >
                    <IndianRupee className="w-4 h-4" />
                    Pay ₹{venue?.discountAmount
                      ? Math.max(1, (venue?.pricePerSong ?? 100) - venue.discountAmount)
                      : (venue?.pricePerSong ?? 100)} via UPI
                  </Button>
                </>
              )}
            </div>

            {/* YouTube embed preview (thumbnail only) */}
            <div className="text-center">
              <a
                href={`https://youtu.be/${displaySong.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 text-xs underline hover:no-underline"
              >
                Preview on YouTube
              </a>
            </div>
          </>
        )}
      </div>

      <BottomSheet open={freeSheetOpen} onClose={() => setFreeSheetOpen(false)} title="Add to queue">
        <div className="flex flex-col gap-5 pt-2">
          <div className="text-center">
            <p className="text-stone-900 font-display text-lg font-semibold truncate max-w-xs">
              {displaySong?.title}
            </p>
            <p className="text-stone-500 text-sm mt-1">No payment required</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-stone-500 mb-1.5">Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={freeFormName}
                onChange={(e) => setFreeFormName(e.target.value)}
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-500 mb-1.5">Mobile number</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={freeFormMobile}
                onChange={(e) => setFreeFormMobile(e.target.value)}
                maxLength={10}
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleFreeSubmit}
            loading={freeSubmitting}
            disabled={!freeFormName.trim() || freeFormMobile.trim().length < 10}
          >
            Add to queue
          </Button>
        </div>
      </BottomSheet>

      {venue?.pricingEnabled !== false && (
        <UpiPaymentSheet
          order={order}
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          onSuccess={handleSuccess}
          songTitle={displaySong?.title}
          amount={venue?.discountAmount
            ? Math.max(1, (venue?.pricePerSong ?? 100) - venue.discountAmount)
            : (venue?.pricePerSong ?? 100)}
          songId={song?.id ?? songId ?? undefined}
          venueId={venueId}
          onCreateOrder={handleCreateOrder}
          customerName={submittedCustomerName}
          customerMobile={submittedCustomerMobile}
        />
      )}
    </div>
  );
}
