import { useEffect, useState, useCallback } from 'react';
import { getSocket, connectSocket } from '../services/socket';

export type ReactionEmoji = 'fire' | 'heart' | 'clap';

export interface ReactionCounts {
  fire: number;
  heart: number;
  clap: number;
}

export function useReactions(venueId: string | undefined) {
  const [counts, setCounts] = useState<ReactionCounts>({ fire: 0, heart: 0, clap: 0 });

  const sendReaction = useCallback(
    (emoji: ReactionEmoji) => {
      if (!venueId) return;
      const socket = getSocket();
      socket.emit('reaction:send', { venueId, emoji });
    },
    [venueId],
  );

  useEffect(() => {
    if (!venueId) return;
    const socket = getSocket();
    connectSocket();
    socket.emit('join:venue', { venueId });

    const handler = (payload: ReactionCounts) => {
      setCounts((prev) => ({ ...prev, ...payload }));
    };
    socket.on('reactions:updated', handler);

    return () => {
      socket.off('reactions:updated', handler);
    };
  }, [venueId]);

  return { counts, sendReaction };
}
