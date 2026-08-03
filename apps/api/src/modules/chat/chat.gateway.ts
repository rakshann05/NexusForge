import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'chat' })
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() payload: { room: string; message: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(payload.room);
    this.server.to(payload.room).emit('message', payload);
    return payload;
  }
}
