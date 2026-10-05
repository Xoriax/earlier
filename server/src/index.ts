import Fastify from 'fastify';
import { Server } from 'socket.io';
import { config } from './config';
import { registerSocketHandlers } from './sockets';
import type { IO } from './types';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

const io: IO = new Server(app.server, {
  cors: { origin: config.clientOrigin },
});
registerSocketHandlers(io);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
