import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

const REACTION_TYPES = ['fire', 'heart', 'clap'] as const;
type ReactionType = (typeof REACTION_TYPES)[number];
const REACTION_RATE_LIMIT_MS = 2000; // min interval between reactions per socket

interface VenueReactions {
  fire: number;
  heart: number;
  clap: number;
  lastActivity: number;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/queue',
})
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);
  private readonly venueReactions = new Map<string, VenueReactions>();
  private readonly socketLastReaction = new Map<string, number>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.socketLastReaction.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private getOrCreateReactions(venueId: string): VenueReactions {
    let r = this.venueReactions.get(venueId);
    if (!r) {
      r = { fire: 0, heart: 0, clap: 0, lastActivity: Date.now() };
      this.venueReactions.set(venueId, r);
    }
    return r;
  }

  @SubscribeMessage('reaction:send')
  handleReaction(
    @MessageBody() data: { venueId: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { venueId, emoji } = data ?? {};
    if (!venueId || !REACTION_TYPES.includes(emoji as ReactionType)) {
      return { ok: false, error: 'Invalid venueId or emoji' };
    }
    const now = Date.now();
    const last = this.socketLastReaction.get(client.id) ?? 0;
    if (now - last < REACTION_RATE_LIMIT_MS) {
      return { ok: false, error: 'Rate limited' };
    }
    this.socketLastReaction.set(client.id, now);
    const reactions = this.getOrCreateReactions(venueId);
    reactions.lastActivity = now;
    reactions[emoji as ReactionType] += 1;
    const payload = {
      fire: reactions.fire,
      heart: reactions.heart,
      clap: reactions.clap,
    };
    this.server.to(`venue:${venueId}`).emit('reactions:updated', payload);
    return { ok: true, ...payload };
  }

  /** Emit current reaction counts to a client (e.g. when they join venue). */
  emitReactionsSnapshot(venueId: string) {
    const r = this.venueReactions.get(venueId);
    if (r) {
      this.server.to(`venue:${venueId}`).emit('reactions:updated', {
        fire: r.fire,
        heart: r.heart,
        clap: r.clap,
      });
    }
  }

  @SubscribeMessage('join:venue')
  handleJoinVenue(
    @MessageBody() data: { venueId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const venueId = data?.venueId;
    if (!venueId) return { joined: false };
    client.join(`venue:${venueId}`);
    this.logger.log(`Client ${client.id} joined venue:${venueId}`);
    this.emitReactionsSnapshot(venueId);
    return { joined: venueId };
  }

  @SubscribeMessage('join:order')
  handleJoinOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`order:${data.orderId}`);
    this.logger.log(`Client ${client.id} joined order:${data.orderId}`);
    return { joined: data.orderId };
  }

  emitQueueUpdated(venueId: string, queue: unknown[]) {
    this.server.to(`venue:${venueId}`).emit('queue:updated', { queue });
  }

  emitQueueConfirmed(orderId: string, payload: unknown) {
    this.server.to(`order:${orderId}`).emit('queue:confirmed', payload);
  }

  emitNowPlaying(venueId: string, payload: unknown) {
    this.server.to(`venue:${venueId}`).emit('queue:now-playing', payload);
  }
}
