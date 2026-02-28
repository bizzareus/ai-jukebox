import { useState, useCallback } from 'react';
import { Music, ListMusic, Flame, Heart, Hand } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QueueItem } from '../types';
import { QueueItemStatus } from '../types';
import { useReactions } from '../hooks/useReactions';
import type { ReactionEmoji } from '../hooks/useReactions';

interface NowPlayingBarProps {
  queue: QueueItem[];
  venueId?: string;
}

const REACTION_ANIMATION_MS = 500;

export function NowPlayingBar({ queue, venueId }: NowPlayingBarProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { counts, sendReaction } = useReactions(venueId);
  const [reactionAnimating, setReactionAnimating] = useState<ReactionEmoji | null>(null);

  const handleReaction = useCallback((emoji: ReactionEmoji) => {
    sendReaction(emoji);
    setReactionAnimating(emoji);
    setTimeout(() => setReactionAnimating(null), REACTION_ANIMATION_MS);
  }, [sendReaction]);

  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const next = queue.find((i) => i.status === QueueItemStatus.PENDING);
  const current = nowPlaying ?? next;

  if (!current) return null;

  const totalReactions = counts.fire + counts.heart + counts.clap;

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
          {nowPlaying && venueId && totalReactions > 0 && (
            <div className="flex items-center gap-3 mt-1 text-stone-500">
              {counts.fire > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> {counts.fire}
                </span>
              )}
              {counts.heart > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> {counts.heart}
                </span>
              )}
              {counts.clap > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Hand className="w-3.5 h-3.5" /> {counts.clap}
                </span>
              )}
            </div>
          )}
        </div>
        {nowPlaying && venueId && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fire reaction"
              className="p-1.5 rounded-full hover:bg-orange-100 text-stone-400 hover:text-orange-500 transition-colors active:scale-95"
              onClick={(e) => { e.stopPropagation(); handleReaction('fire'); }}
            >
              <Flame
                className={`w-4 h-4 ${reactionAnimating === 'fire' ? 'animate-upvote-pop text-orange-500' : ''}`}
              />
            </button>
            <button
              type="button"
              aria-label="Heart reaction"
              className="p-1.5 rounded-full hover:bg-rose-100 text-stone-400 hover:text-rose-500 transition-colors active:scale-95"
              onClick={(e) => { e.stopPropagation(); handleReaction('heart'); }}
            >
              <Heart
                className={`w-4 h-4 ${reactionAnimating === 'heart' ? 'animate-upvote-pop text-rose-500' : ''}`}
              />
            </button>
            <button
              type="button"
              aria-label="Clap reaction"
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors active:scale-95"
              onClick={(e) => { e.stopPropagation(); handleReaction('clap'); }}
            >
              <Hand
                className={`w-4 h-4 ${reactionAnimating === 'clap' ? 'animate-upvote-pop text-stone-600' : ''}`}
              />
            </button>
          </div>
        )}
        {nowPlaying && !venueId && (
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
        {!nowPlaying && <ListMusic className="w-5 h-5 text-stone-400 flex-shrink-0" />}
      </div>
    </div>
  );
}
