import { WebSocket, WebSocketServer } from 'ws';
import {
  clientMessageSchema,
  MAX_SIGNAL_BYTES,
  type ServerMessage,
} from '@peerbeam/protocol';
import { SessionManager, WAITING_TTL_MS, ABSOLUTE_TTL_MS } from './sessions';
import { JoinLimiter } from './joinLimiter';
export const MAX_SOCKETS = 1000;

export function createSignalingServer(options: {
  port: number;
  host?: string;
  origins?: string[];
  ttlMs?: number;
  now?: () => number;
  absoluteTtlMs?: number;
  maxSockets?: number;
  maxSessions?: number;
  sweepMs?: number;
}) {
  const now = options.now ?? Date.now;
  const waitingTtl = options.ttlMs ?? WAITING_TTL_MS;
  const absoluteTtl = options.absoluteTtlMs ?? ABSOLUTE_TTL_MS;
  for (const value of [
    waitingTtl,
    absoluteTtl,
    options.maxSockets ?? MAX_SOCKETS,
    options.maxSessions ?? 500,
    options.sweepMs ?? 30_000,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error('Server limits must be positive safe integers.');
  }
  const sessions = new SessionManager<WebSocket>(
    waitingTtl,
    now,
    undefined,
    absoluteTtl,
    options.maxSessions,
  );
  const wss = new WebSocketServer({
    port: options.port,
    host: options.host ?? '127.0.0.1',
    maxPayload: MAX_SIGNAL_BYTES,
    perMessageDeflate: false,
    verifyClient: ({ origin }: { origin: string }) =>
      wss.clients.size < (options.maxSockets ?? MAX_SOCKETS) &&
      (!options.origins?.length || options.origins.includes(origin)),
  });
  const send = (socket: WebSocket, message: ServerMessage) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_SIGNAL_BYTES * 4) {
      socket.terminate();
      return;
    }
    socket.send(JSON.stringify(message));
  };
  const alive = new Set<WebSocket>();
  const connectedAt = new Map<WebSocket, number>();
  const expireSocket = (socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    send(socket, { type: 'session-error', reason: 'session-expired' });
    socket.close(1000, 'Signaling lifetime expired');
    const deadline = setTimeout(() => socket.terminate(), 5000);
    deadline.unref();
    socket.once('close', () => clearTimeout(deadline));
  };
  wss.on('connection', (socket) => {
    connectedAt.set(socket, now());
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
    let windowStart = Date.now();
    let messages = 0;
    const joins = new JoinLimiter(options.now);
    socket.on('message', (raw, binary) => {
      if (Date.now() - windowStart > 10_000) {
        windowStart = Date.now();
        messages = 0;
      }
      if (++messages > 200) {
        send(socket, { type: 'session-error', reason: 'rate-limited' });
        socket.close(1008);
        return;
      }
      let value: unknown;
      try {
        value = binary ? null : JSON.parse(raw.toString());
      } catch {
        value = null;
      }
      const parsed = clientMessageSchema.safeParse(value);
      const joining =
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'join-session';
      if (joining && joins.blocked) {
        send(socket, { type: 'session-error', reason: 'rate-limited' });
        return;
      }
      if (!parsed.success) {
        if (joining) joins.fail();
        send(socket, { type: 'session-error', reason: 'invalid-message' });
        return;
      }
      const message = parsed.data;
      if (message.type === 'ping') {
        send(socket, { type: 'pong' });
        return;
      }
      if (
        message.type === 'create-session' ||
        message.type === 'join-session'
      ) {
        const result =
          message.type === 'create-session'
            ? sessions.create(socket)
            : sessions.join(message.code, socket);
        if (!result.ok) {
          if (message.type === 'join-session') joins.fail();
          send(socket, { type: 'session-error', reason: result.reason });
          return;
        }
        const { session } = result;
        send(socket, {
          type:
            message.type === 'create-session'
              ? 'session-created'
              : 'session-joined',
          sessionId: session.id,
          code: session.code,
        });
        if (session.peers.length === 2)
          session.peers.forEach((peer, index) =>
            send(peer, { type: 'peer-ready', initiator: index === 0 }),
          );
        return;
      }
      const session = sessions.forPeer(socket);
      if (!session) {
        send(socket, { type: 'session-error', reason: 'not-in-session' });
        return;
      }
      const other = session.peers.find((peer) => peer !== socket);
      if (!other) {
        send(socket, { type: 'session-error', reason: 'peer-unavailable' });
        return;
      }
      sessions.touch(session);
      send(other, message);
    });
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      alive.delete(socket);
      connectedAt.delete(socket);
      for (const peer of sessions.leave(socket))
        send(peer, { type: 'peer-disconnected' });
    });
  });
  const sweep = setInterval(() => {
    for (const peer of sessions.expire()) expireSocket(peer);
    for (const socket of wss.clients) {
      const age = now() - (connectedAt.get(socket) ?? now());
      if (
        age >= absoluteTtl ||
        (!sessions.forPeer(socket) && age >= waitingTtl)
      ) {
        expireSocket(socket);
        continue;
      }
      if (!alive.delete(socket)) socket.terminate();
      else socket.ping();
    }
  }, options.sweepMs ?? 30_000);
  sweep.unref();
  wss.on('close', () => clearInterval(sweep));
  return {
    wss,
    sessions,
    close: async () => {
      clearInterval(sweep);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolve, reject) =>
        wss.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
