import type { Ack } from '@earlier/shared';
import { LIMITS } from '@earlier/shared';
import { Room } from './room';
import type { AppSocket, IO } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rooms = new Map<string, Room>();

function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, LIMITS.nameMaxLength) : '';
}

function fail(ack: Ack<never>, error: string): void {
  ack({ ok: false, error });
}

export function registerSocketHandlers(io: IO): void {
  io.on('connection', (socket: AppSocket) => {
    const currentRoom = () => (socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined);

    const leave = () => {
      const room = currentRoom();
      if (!room) return;
      socket.leave(room.code);
      socket.data.roomCode = undefined;
      room.removePlayer(socket.id);
      if (room.isEmpty) rooms.delete(room.code);
    };

    socket.on('time:sync', (ack) => ack(Date.now()));

    socket.on('room:create', ({ name }, ack) => {
      const playerName = cleanName(name);
      if (!playerName) return fail(ack, 'Choisis un pseudo.');
      leave();

      const room = new Room(generateCode(), io, socket.id);
      rooms.set(room.code, room);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      room.addPlayer(socket.id, playerName);
      ack({ ok: true, data: room.state() });
    });

    socket.on('room:join', ({ code, name }, ack) => {
      const playerName = cleanName(name);
      if (!playerName) return fail(ack, 'Choisis un pseudo.');
      const room = rooms.get(String(code ?? '').trim().toUpperCase());
      if (!room) return fail(ack, 'Partie introuvable.');
      if (room.hasName(playerName)) return fail(ack, 'Ce pseudo est déjà pris dans cette partie.');
      leave();

      socket.join(room.code);
      socket.data.roomCode = room.code;
      room.addPlayer(socket.id, playerName);
      ack({ ok: true, data: room.state() });

      const active = room.activeRound;
      if (active && 'prepare' in active) socket.emit('round:prepare', active.prepare);
      if (active && 'start' in active) socket.emit('round:start', active.start);
    });

    socket.on('room:leave', leave);
    socket.on('disconnect', leave);

    socket.on('room:settings', (settings) => {
      currentRoom()?.updateSettings(socket.id, settings ?? {});
    });

    socket.on('game:start', async (ack) => {
      const room = currentRoom();
      if (!room) return fail(ack, 'Tu ne fais partie d’aucune partie.');
      try {
        await room.start(socket.id);
        ack({ ok: true, data: null });
      } catch (err) {
        fail(ack, err instanceof Error ? err.message : 'Impossible de lancer la partie.');
      }
    });

    socket.on('round:ready', (round) => {
      currentRoom()?.markReady(socket.id, round);
    });

    socket.on('guess', (text, ack) => {
      const room = currentRoom();
      if (!room || typeof text !== 'string') return ack({ title: false, artist: false, points: 0 });
      ack(room.guess(socket.id, text.slice(0, 200)));
    });
  });
}
