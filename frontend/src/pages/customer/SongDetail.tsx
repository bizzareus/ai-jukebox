import { useState } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, IndianRupee } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { UpiPaymentSheet, type QueueConfirmPayload } from '../../components/UpiPaymentSheet';
import type { Song, Venue, CreateOrderResponse } from '../../types';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
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

  const { data: venue } = useQuery<Venue>({
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

  const handleOpenPayment = () => {
    if (!song || !venueId) return;
    setOrder(null);
    setPaymentOpen(true);
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

            {/* Pay CTA */}
            <div className="bg-surface-card rounded-2xl border border-surface-border shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-stone-600 text-sm">Song play</span>
                <div className="flex items-center gap-1 text-stone-900 font-bold">
                  <IndianRupee className="w-4 h-4 text-brand-600" />
                  <span className="text-lg">{venue?.pricePerSong ?? 100}</span>
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
                Pay ₹{venue?.pricePerSong ?? 100} via UPI
              </Button>
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

      <UpiPaymentSheet
        order={order}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={handleSuccess}
        songTitle={displaySong?.title}
        amount={venue?.pricePerSong ?? 100}
        songId={song?.id ?? songId ?? undefined}
        venueId={venueId}
        onCreateOrder={handleCreateOrder}
        customerName={submittedCustomerName}
        customerMobile={submittedCustomerMobile}
      />
    </div>
  );
}
