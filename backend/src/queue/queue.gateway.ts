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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/queue',
})
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:venue')
  handleJoinVenue(
    @MessageBody() data: { venueId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`venue:${data.venueId}`);
    this.logger.log(`Client ${client.id} joined venue:${data.venueId}`);
    return { joined: data.venueId };
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
