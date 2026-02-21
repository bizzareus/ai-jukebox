import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';
import type { QueueItem } from '../types';

export function useQueue(venueId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<QueueItem[]>({
    queryKey: ['queue', venueId],
    queryFn: () => api.get<QueueItem[]>(`/queue/${venueId}`),
    enabled: !!venueId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!venueId) return;
    const socket = getSocket();
    connectSocket();
    socket.emit('join:venue', { venueId });

    const handler = ({ queue }: { queue: QueueItem[] }) => {
      queryClient.setQueryData(['queue', venueId], queue);
    };
    socket.on('queue:updated', handler);

    return () => { socket.off('queue:updated', handler); };
  }, [venueId, queryClient]);

  return query;
}
