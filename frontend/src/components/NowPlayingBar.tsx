import { Music, ListMusic } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QueueItem } from '../types';
import { QueueItemStatus } from '../types';

interface NowPlayingBarProps {
  queue: QueueItem[];
}

export function NowPlayingBar({ queue }: NowPlayingBarProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const next = queue.find((i) => i.status === QueueItemStatus.PENDING);
  const current = nowPlaying ?? next;

  if (!current) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-surface-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3 cursor-pointer"
      onClick={() => navigate(`/${slug}/queue`)}
    >
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100">
          {current.song.thumbnailUrl ? (
            <img src={current.song.thumbnailUrl} alt={current.song.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-4 h-4 text-stone-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-stone-900 text-sm font-medium truncate">{current.song.title}</p>
          <p className="text-stone-500 text-xs">
            {nowPlaying ? 'Now Playing' : `Up next • ${queue.filter(i => i.status === QueueItemStatus.PENDING).length} in queue`}
          </p>
        </div>
        {nowPlaying && (
          <div className="flex items-end gap-[3px] h-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1 bg-brand-500 rounded-full animate-bounce"
                style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
        <ListMusic className="w-5 h-5 text-stone-400 flex-shrink-0" />
      </div>
    </div>
  );
}
