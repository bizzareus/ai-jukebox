import { useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Music2, Clock, CheckCircle2 } from 'lucide-react';
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

export default function QueueView() {
  const { slug } = useParams<{ slug: string }>();
  const { state } = useLocation();
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

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="px-4 pt-10 pb-6">
        <h1 className="font-display text-2xl font-bold text-stone-900">Song Queue</h1>
        <p className="text-stone-500 text-sm mt-1">{venue?.name}</p>
      </div>

      {/* My song confirmed banner */}
      {confirmedItem && myItem && (
        <div className="mx-4 mb-5 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-green-800 font-semibold text-sm">Your song is queued!</p>
            <p className="text-green-700 text-xs">
              Position #{myItem.position} · {formatEta(myItem.eta ?? confirmedItem.eta)}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Now Playing */}
          {nowPlaying && (
            <div className="mx-4 mb-5">
              <h2 className="text-xs font-medium text-brand-600 uppercase tracking-wider mb-2">Now Playing</h2>
              <div className="bg-white border border-brand-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  {nowPlaying.song.thumbnailUrl ? (
                    <img src={nowPlaying.song.thumbnailUrl} alt={nowPlaying.song.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-stone-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-stone-900 font-semibold truncate">{nowPlaying.song.title}</p>
                  <p className="text-stone-500 text-xs truncate">{nowPlaying.song.artist ?? nowPlaying.song.channelName}</p>
                  {nowPlaying.customerName && (
                    <p className="text-brand-600 text-xs mt-0.5">Queued by {nowPlaying.customerName}</p>
                  )}
                </div>
                <div className="flex items-end gap-[3px] h-4 flex-shrink-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-brand-500 rounded-full animate-bounce"
                      style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming queue */}
          {pending.length > 0 && (
            <div className="mx-4">
              <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Up Next · {pending.length} song{pending.length !== 1 ? 's' : ''}
              </h2>
              <div className="flex flex-col">
                {pending.map((item, index) => {
                  const isMyItem = item.id === myItem?.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isMyItem ? 'bg-brand-50 border border-brand-200' : 'hover:bg-stone-50'}`}
                    >
                      <span className="text-stone-500 text-sm w-6 text-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100">
                        {item.song.thumbnailUrl ? (
                          <img src={item.song.thumbnailUrl} alt={item.song.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 className="w-4 h-4 text-stone-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isMyItem ? 'text-brand-700' : 'text-stone-900'}`}>
                          {item.song.title}
                        </p>
                        <p className="text-stone-500 text-xs truncate">
                          {item.customerName ? `By ${item.customerName}` : (item.song.artist ?? item.song.channelName)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-stone-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{formatEta(item.eta ?? 0)}</span>
                        </div>
                        {isMyItem && <span className="text-xs text-brand-600 font-medium">Your song</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!nowPlaying && pending.length === 0 && (
            <div className="text-center py-20 text-stone-500">
              <Music2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Queue is empty</p>
              <p className="text-sm mt-1">Be the first to queue a song!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
