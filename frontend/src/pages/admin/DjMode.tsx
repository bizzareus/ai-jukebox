import { useCallback, useEffect, useRef, useState } from 'react';
import { SkipForward, Music2, Play, ListMusic } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useQueue } from '../../hooks/useQueue';
import { authService } from '../../services/auth';
import { QueueItemStatus, type QueueItem } from '../../types';

/** End the video this many seconds before the actual end (stop early like typical jukebox behaviour) */
const END_VIDEO_BEFORE_SECONDS = 25;
/** Short fade duration before stopping (smoother transition to next) */
const FADE_DURATION_SECONDS = 5;
const FADE_TICK_MS = 250;

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
  interface YTPlayer {
    loadVideoById: (videoId: string) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    stopVideo: () => void;
    destroy: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getVolume: () => number;
    setVolume: (volume: number) => void;
  }
}

export default function DjMode() {
  const admin = authService.getStoredAdmin();
  const venueId = admin?.venueId;

  const queryClient = useQueryClient();
  const { data: queue = [] } = useQueue(venueId);
  const { data: recentPlays = [] } = useQuery({
    queryKey: ['recent-plays', venueId],
    queryFn: () => api.get<QueueItem[]>(`/queue/${venueId}/recent-plays?limit=10`),
    enabled: !!venueId,
  });
  const playerRef = useRef<YTPlayer | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeStartedRef = useRef(false);

  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const pending = queue.filter((i) => i.status === QueueItemStatus.PENDING);

  const advancingRef = useRef(false);
  const handleAdvance = useCallback(async () => {
    if (!venueId || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    try {
      await api.post('/queue/advance', {});
    } finally {
      setAdvancing(false);
      advancingRef.current = false;
    }
  }, [venueId]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) { setYtReady(true); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // Create/update player when nowPlaying changes
  useEffect(() => {
    if (!ytReady || !nowPlaying) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(nowPlaying.song.youtubeVideoId);
      playerRef.current.playVideo();
    } else {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: nowPlaying.song.youtubeVideoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED && autoAdvance) {
              handleAdvance();
            }
          },
        },
      });
    }
  }, [ytReady, nowPlaying?.song?.youtubeVideoId, handleAdvance]);

  // End video 20–30s before actual end: check every second, then short fade and stop (inspiration: stopVideo when duration - current <= 20)
  useEffect(() => {
    if (!nowPlaying || !autoAdvance) return;

    fadeStartedRef.current = false;

    const clearAll = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };

    const endEarly = (p: YTPlayer) => {
      if (fadeStartedRef.current) return;
      fadeStartedRef.current = true;
      clearAll();

      const fadeDurationMs = FADE_DURATION_SECONDS * 1000;
      const steps = Math.max(1, Math.floor(fadeDurationMs / FADE_TICK_MS));
      const volumeStep = 100 / steps;
      let step = 0;

      fadeIntervalRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player) return;
        step += 1;
        const vol = Math.max(0, Math.round(100 - step * volumeStep));
        player.setVolume(vol);
        if (vol <= 0) {
          clearAll();
          player.stopVideo();
          handleAdvance();
        }
      }, FADE_TICK_MS);
    };

    progressIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getDuration !== 'function') return;
      const duration = p.getDuration();
      if (duration <= 0) return;
      const current = p.getCurrentTime();
      const remaining = duration - current;
      if (remaining <= END_VIDEO_BEFORE_SECONDS) {
        endEarly(p);
      }
    }, 1000);

    return () => {
      clearAll();
    };
  }, [nowPlaying?.id, autoAdvance, handleAdvance]);

  const handleStartFirst = async () => {
    const first = pending[0];
    if (!first || !venueId) return;
    setAdvancing(true);
    try {
      await api.post(`/queue/${first.id}/play`, {});
      queryClient.setQueryData<QueueItem[]>(['queue', venueId], (prev) =>
        prev?.map((item) =>
          item.id === first.id ? { ...item, status: QueueItemStatus.PLAYING } : item,
        ) ?? [],
      );
      queryClient.invalidateQueries({ queryKey: ['queue', venueId] });
    } finally {
      setAdvancing(false);
    }
  };

  const handleReplay = async (songId: string, mode: 'immediate' | 'queue_next') => {
    if (!venueId) return;
    setReplayingId(songId);
    try {
      await api.post('/queue/replay', { songId, mode });
      queryClient.invalidateQueries({ queryKey: ['queue', venueId] });
      queryClient.invalidateQueries({ queryKey: ['recent-plays', venueId] });
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-stone-900">DJ Mode</h1>
        <label className="flex items-center gap-2 text-sm text-stone-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
            className="accent-brand-600 w-4 h-4"
          />
          Auto-advance
        </label>
      </div>

      {/* YouTube Player */}
      {nowPlaying ? (
        <div className="rounded-2xl overflow-hidden border border-surface-border bg-black aspect-video">
          <div id="yt-player" className="w-full h-full" />
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-white flex flex-col items-center justify-center aspect-video gap-3 text-stone-500 shadow-sm">
          <Music2 className="w-10 h-10 opacity-40" />
          <p className="text-sm">No song playing</p>
          {pending.length > 0 && (
            <Button variant="primary" size="sm" onClick={handleStartFirst} loading={advancing}>
              Start Queue
            </Button>
          )}
        </div>
      )}

      {/* Now Playing Info */}
      {nowPlaying && (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-stone-900 font-semibold truncate">{nowPlaying.song.title}</p>
            {nowPlaying.customerName && (
              <p className="text-brand-400 text-xs">Requested by {nowPlaying.customerName}</p>
            )}
          </div>
          <Button onClick={handleAdvance} loading={advancing} variant="outline" size="sm">
            <SkipForward className="w-4 h-4" />
            Next
          </Button>
        </div>
      )}

      {/* Queue */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Up Next ({pending.length})
          </h2>
          <div className="flex flex-col gap-1">
            {pending.map((item: QueueItem, i) => (
              <Card key={item.id} className="flex items-center gap-3 p-3">
                <span className="text-stone-500 text-xs w-4 text-center">{i + 1}</span>
                {item.song.thumbnailUrl && (
                  <img src={item.song.thumbnailUrl} alt={item.song.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-stone-900 text-sm font-medium truncate">{item.song.title}</p>
                  {item.customerName && <p className="text-stone-500 text-xs">{item.customerName}</p>}
                </div>
                <button
                  onClick={() => api.post(`/queue/${item.id}/skip`, {})}
                  className="text-stone-500 hover:text-red-600 p-1 rounded transition-colors text-xs"
                >
                  Skip
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past 10 plays — replay */}
      <div>
        <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
          Past 10 plays
        </h2>
        {recentPlays.length === 0 ? (
          <p className="text-stone-500 text-sm">No plays yet</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recentPlays.map((item: QueueItem) => (
              <Card key={item.id} className="flex items-center gap-3 p-3">
                {item.song?.thumbnailUrl ? (
                  <img
                    src={item.song.thumbnailUrl}
                    alt={item.song.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <Music2 className="w-4 h-4 text-stone-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-stone-900 text-sm font-medium truncate">
                    {item.song?.title ?? '—'}
                  </p>
                  <p className="text-stone-500 text-xs">
                    {item.playedAt
                      ? new Date(item.playedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReplay(item.song.id, 'immediate')}
                    disabled={replayingId === item.song.id}
                    className="!py-1.5 !px-2 text-xs"
                    title="Play now"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReplay(item.song.id, 'queue_next')}
                    disabled={replayingId === item.song.id}
                    className="!py-1.5 !px-2 text-xs"
                    title="Queue next"
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
