import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@earlier/shared';

export interface SocketData {
  roomCode?: string;
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
