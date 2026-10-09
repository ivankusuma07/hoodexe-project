import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { CALLOUTS_CHANNEL } from '../services/pubsub';

const PING_MS = 25_000;
const MAX_CLIENTS = 5_000;

/**
 * GET /ws (docs/BRIEF.md §9): pushes new callouts and reaction counts to every open window. Read-only;
 * posting goes through the HTTP routes, so no message from a client is ever trusted or relayed.
 */
export async function liveRoutes(app: FastifyInstance) {
  const clients = new Set<WebSocket>();

  const unsubscribe = await app.deps.pubsub.subscribe(CALLOUTS_CHANNEL, (message) => {
    const data = JSON.stringify(message);
    for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(data);
  });

  // An application-level ping the browser can see: the client uses its absence to detect a dead link.
  const ping = setInterval(() => {
    const data = JSON.stringify({ type: 'ping', at: Date.now() });
    for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(data);
  }, PING_MS);

  app.addHook('onClose', async () => {
    clearInterval(ping);
    await unsubscribe();
    for (const ws of clients) ws.close(1001, 'server shutting down');
  });

  app.get('/ws', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (origin && !app.deps.env.CORS_ORIGINS.includes(origin)) {
      socket.close(1008, 'origin not allowed');
      return;
    }
    if (clients.size >= MAX_CLIENTS) {
      socket.close(1013, 'try again later');
      return;
    }
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'hello', pingMs: PING_MS }));
    socket.on('message', () => {});
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });
}
