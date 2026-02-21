import { useEffect } from 'react';
import { getSocket, connectSocket } from '../services/socket';

export function useSocket(venueId: string | undefined, handlers: Record<string, (data: unknown) => void>) {
  useEffect(() => {
    if (!venueId) return;
    const socket = getSocket();
    connectSocket();

    socket.emit('join:venue', { venueId });

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);
}

export function useOrderSocket(
  orderId: string | undefined,
  onConfirmed: (data: unknown) => void,
) {
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    connectSocket();

    socket.emit('join:order', { orderId });
    socket.on('queue:confirmed', onConfirmed);

    return () => {
      socket.off('queue:confirmed', onConfirmed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
}
