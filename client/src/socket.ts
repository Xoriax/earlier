import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from '@earlier/shared';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: true });

/** Transforme un ack { ok, data | error } en promesse */
export function unwrap<T>(res: AckResponse<T>): T {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
