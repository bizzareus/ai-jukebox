import { Music, Clock } from 'lucide-react';
import type { Song } from '../../types';

interface SongCardProps {
  song: Song;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SongCard({ song, onClick, rightSlot, compact }: SongCardProps) {
  return (
    <div
      className={`flex items-center gap-3 ${compact ? 'py-2' : 'p-3'} rounded-xl hover:bg-stone-50 transition-colors ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <div className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-lg overflow-hidden flex-shrink-0 bg-stone-100`}>
        {song.thumbnailUrl ? (
          <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <Music className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-stone-900 truncate ${compact ? 'text-sm' : ''}`}>{song.title}</p>
        <p className="text-xs text-stone-500 truncate">{song.artist ?? song.channelName ?? 'Unknown artist'}</p>
        {!compact && (
          <div className="flex items-center gap-1 mt-0.5 text-stone-500">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{formatDuration(song.durationSeconds)}</span>
          </div>
        )}
      </div>
      {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
    </div>
  );
}
