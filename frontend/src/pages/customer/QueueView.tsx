import { useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Music2, ChevronDown, MoreVertical, User, Zap, Plus, Flame, Heart, Hand, ThumbsUp } from 'lucide-react';
import { api } from '../../services/api';
import { useQueue } from '../../hooks/useQueue';
import { useReactions } from '../../hooks/useReactions';
import { QueueItemStatus, type Venue, type QueueItem } from '../../types';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'Up next!';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `~${s}s`;
  return `~${m}m ${s}s`;
}

function getOrCreateVoteSessionId(venueId: string): string {
  const key = `jukebox_vote_session_${venueId}`;
  let sessionId = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (!sessionId) {
    sessionId = crypto.randomUUID?.() ?? `s${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
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
  const { counts, sendReaction } = useReactions(venue?.id);
  const [upvoteAnimatingId, setUpvoteAnimatingId] = useState<string | null>(null);
  const [reactionAnimating, setReactionAnimating] = useState<'fire' | 'heart' | 'clap' | null>(null);

  const handleReaction = useCallback((emoji: 'fire' | 'heart' | 'clap') => {
    sendReaction(emoji);
    setReactionAnimating(emoji);
    setTimeout(() => setReactionAnimating(null), 500);
  }, [sendReaction]);

  const handleUpvote = useCallback(
    (itemId: string) => {
      if (!venue?.id) return;
      setUpvoteAnimatingId(itemId);
      api.post(`/queue/${itemId}/upvote`, { sessionId: getOrCreateVoteSessionId(venue.id) }).catch(() => {});
      setTimeout(() => setUpvoteAnimatingId(null), 500);
    },
    [venue],
  );

  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const pending = queue.filter((i) => i.status === QueueItemStatus.PENDING);

  const myItem: QueueItem | undefined = confirmedItem
    ? queue.find((i) => i.id === confirmedItem?.queueItem?.id)
    : undefined;

  const isNowPlayingMySong = nowPlaying && myItem?.id === nowPlaying.id;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header: back + menu */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-10 pb-2 bg-surface/95 backdrop-blur-sm border-b border-surface-border">
        <button
          type="button"
          onClick={() => navigate(`/${slug}`)}
          className="p-2 -ml-2 rounded-full bg-white/90 backdrop-blur-sm text-stone-900 shadow-sm hover:bg-stone-50 transition-colors"
          aria-label="Back"
        >
          <ChevronDown className="w-6 h-6 rotate-90" />
        </button>
        <button
          type="button"
          className="p-2 rounded-full text-stone-600 hover:bg-stone-100 transition-colors"
          aria-label="Menu"
        >
          <MoreVertical className="w-5 h-5" />
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
                    {nowPlaying.dedicationMessage && (
                      <p className="text-stone-600 text-sm italic mt-1 truncate">&ldquo;{nowPlaying.dedicationMessage}&rdquo;</p>
                    )}
                    <div className="mt-2">
                      <SubmitterBadge
                        name={nowPlaying.customerName === 'System' ? 'Jukebox' : (nowPlaying.customerName ?? '—')}
                      />
                    </div>
                    {venue?.id && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-stone-400 text-xs">React:</span>
                        <button
                          type="button"
                          aria-label="Fire"
                          className="p-1.5 rounded-full hover:bg-orange-100 text-stone-400 hover:text-orange-500 transition-colors active:scale-95"
                          onClick={() => handleReaction('fire')}
                        >
                          <Flame className={`w-4 h-4 ${reactionAnimating === 'fire' ? 'animate-upvote-pop text-orange-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          aria-label="Heart"
                          className="p-1.5 rounded-full hover:bg-rose-100 text-stone-400 hover:text-rose-500 transition-colors active:scale-95"
                          onClick={() => handleReaction('heart')}
                        >
                          <Heart className={`w-4 h-4 ${reactionAnimating === 'heart' ? 'animate-upvote-pop text-rose-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          aria-label="Clap"
                          className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors active:scale-95"
                          onClick={() => handleReaction('clap')}
                        >
                          <Hand className={`w-4 h-4 ${reactionAnimating === 'clap' ? 'animate-upvote-pop text-stone-600' : ''}`} />
                        </button>
                        {(counts.fire > 0 || counts.heart > 0 || counts.clap > 0) && (
                          <span className="text-stone-500 text-xs">
                            {counts.fire > 0 && <><Flame className="w-3 h-3 inline text-orange-500" /> {counts.fire}</>}
                            {counts.heart > 0 && <><Heart className="w-3 h-3 inline text-rose-500 ml-1" /> {counts.heart}</>}
                            {counts.clap > 0 && <><Hand className="w-3 h-3 inline ml-1" /> {counts.clap}</>}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="w-10 h-10 rounded-full border border-surface-border flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors shrink-0"
                    aria-label="Add to playlist"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
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
                        {item.dedicationMessage && (
                          <p className="text-stone-600 text-xs italic truncate mt-0.5">&ldquo;{item.dedicationMessage}&rdquo;</p>
                        )}
                        <div className="mt-1">
                          <SubmitterBadge
                            name={item.customerName === 'System' ? 'Jukebox' : (item.customerName ?? '—')}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {venue?.id && (
                          <button
                            type="button"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-brand-600 transition-colors text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpvote(item.id);
                            }}
                            aria-label="Upvote"
                          >
                            <ThumbsUp
                              className={`w-3.5 h-3.5 shrink-0 ${upvoteAnimatingId === item.id ? 'animate-upvote-pop text-brand-600' : ''}`}
                            />
                            {(item.voteCount ?? 0) > 0 && <span>{item.voteCount}</span>}
                          </button>
                        )}
                        <div className="w-8 h-8 rounded-full border border-brand-200 flex items-center justify-center text-brand-600">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <button
                          type="button"
                          className="p-2 text-stone-400 hover:text-stone-700 transition-colors"
                          aria-label="Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !nowPlaying ? (
              <div className="text-center py-16 text-stone-500">
                <Music2 className="w-14 h-14 mx-auto mb-4 opacity-40" />
                <p className="font-medium text-stone-700">Queue is empty</p>
                <p className="text-sm mt-1">Be the first to queue a song!</p>
                <button
                  type="button"
                  onClick={() => navigate(`/${slug}`)}
                  className="mt-4 text-brand-600 text-sm font-medium hover:underline"
                >
                  Pick a song
                </button>
              </div>
            ) : (
              <p className="text-stone-500 text-sm text-center py-8 px-4">
                No more songs in queue
              </p>
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
