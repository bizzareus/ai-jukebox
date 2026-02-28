import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Music2, ChevronDown, User, Zap, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { useQueue } from '../../hooks/useQueue';
import { QueueItemStatus, type Venue, type QueueItem } from '../../types';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'Up next!';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `~${s}s`;
  return `~${m}m ${s}s`;
}

function SubmitterBadge({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 text-stone-500">
      <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
        <User className="w-2.5 h-2.5 text-brand-600" />
      </div>
      <span className="text-xs truncate">{name}</span>
    </div>
  );
}

export default function QueueView() {
  const { slug } = useParams<{ slug: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const confirmedItem = state?.confirmedItem;

  const { data: venue } = useQuery<Venue>({
    queryKey: ['venue', slug],
    queryFn: () => api.get<Venue>(`/venues/${slug}`),
    enabled: !!slug,
  });

  const { data: queue = [], isLoading } = useQueue(venue?.id);

  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const pending = queue.filter((i) => i.status === QueueItemStatus.PENDING);

  const myItem: QueueItem | undefined = confirmedItem
    ? queue.find((i) => i.id === confirmedItem?.queueItem?.id)
    : undefined;

  const isNowPlayingMySong = nowPlaying && myItem?.id === nowPlaying.id;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header: back — safe-top clears mobile browser address bar */}
      <div className="sticky top-0 z-10 flex items-center px-4 pb-2 bg-surface/95 backdrop-blur-sm border-b border-surface-border safe-top">
        <button
          type="button"
          onClick={() => navigate(`/${slug}`)}
          className="p-2 -ml-2 rounded-full bg-white/90 backdrop-blur-sm text-stone-900 shadow-sm hover:bg-stone-50 transition-colors"
          aria-label="Back"
        >
          <ChevronDown className="w-6 h-6 rotate-90" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Now Playing – hero */}
          {nowPlaying && (
            <div className="px-4 pb-6">
              <div className="max-w-sm mx-auto">
                <div className="aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-stone-100 shadow-lg border border-surface-border">
                  {nowPlaying.song.thumbnailHqUrl || nowPlaying.song.thumbnailUrl ? (
                    <img
                      src={nowPlaying.song.thumbnailHqUrl || nowPlaying.song.thumbnailUrl}
                      alt={nowPlaying.song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-16 h-16 text-stone-400" />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-bold text-stone-900 truncate">
                        {nowPlaying.song.title}
                      </h1>
                      {isNowPlayingMySong && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium shrink-0">
                          <Zap className="w-3 h-3" />
                          Your song
                        </span>
                      )}
                    </div>
                    <p className="text-stone-500 text-sm mt-0.5 truncate">
                      {nowPlaying.song.artist ?? nowPlaying.song.channelName}
                    </p>
                    <div className="mt-2">
                      <SubmitterBadge
                        name={nowPlaying.customerName === 'System' ? 'Jukebox' : (nowPlaying.customerName ?? '—')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Queue list */}
          <div className="bg-surface-card border-t border-surface-border rounded-t-2xl pt-5 pb-8 min-h-[40vh] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <div className="px-4 mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                Up next
                {pending.length > 0 && ` · ${pending.length} song${pending.length !== 1 ? 's' : ''}`}
              </h2>
            </div>
            {pending.length > 0 ? (
              <div className="flex flex-col">
                {pending.map((item, index) => {
                  const isMyItem = item.id === myItem?.id;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/80 transition-colors"
                    >
                      <span className="text-stone-500 text-sm w-6 text-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-stone-100">
                        {item.song.thumbnailUrl ? (
                          <img
                            src={item.song.thumbnailUrl}
                            alt={item.song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 className="w-5 h-5 text-stone-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-stone-900 text-sm font-medium truncate">
                            {item.song.title}
                          </p>
                          {isMyItem && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium shrink-0">
                              <Zap className="w-2.5 h-2.5" />
                              Your song
                            </span>
                          )}
                        </div>
                        <p className="text-stone-500 text-xs truncate mt-0.5">
                          {item.song.artist ?? item.song.channelName}
                        </p>
                        <div className="mt-1">
                          <SubmitterBadge
                            name={item.customerName === 'System' ? 'Jukebox' : (item.customerName ?? '—')}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => navigate(`/${slug}`)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-stone-200 text-stone-600 text-sm font-medium hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add another song to queue
                  </button>
                </div>
              </div>
            ) : !nowPlaying ? (
              <div className="text-center py-16 text-stone-500">
                <Music2 className="w-14 h-14 mx-auto mb-4 opacity-40" />
                <p className="font-medium text-stone-700">Queue is empty</p>
                <p className="text-sm mt-1">Be the first to queue a song!</p>
                <button
                  type="button"
                  onClick={() => navigate(`/${slug}`)}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add a song to queue
                </button>
              </div>
            ) : (
              <div className="text-center py-8 px-4">
                <p className="text-stone-500 text-sm mb-4">No more songs in queue</p>
                <button
                  type="button"
                  onClick={() => navigate(`/${slug}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add another song to queue
                </button>
              </div>
            )}
          </div>

          {/* Success toast when just confirmed */}
          {confirmedItem && myItem && (
            <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto px-4 py-3 bg-emerald-500/95 text-white rounded-xl shadow-lg flex items-center gap-3 z-20">
              <div className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Your song is queued!</p>
                <p className="text-white/90 text-xs">
                  #{myItem.position} · {formatEta(myItem.eta ?? confirmedItem.eta)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
