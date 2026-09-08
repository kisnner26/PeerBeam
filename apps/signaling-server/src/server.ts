import { WebSocket, WebSocketServer } from 'ws';
import {
  clientMessageSchema,
  MAX_SIGNAL_BYTES,
  type ServerMessage,
} from '@peerbeam/protocol';
import { SessionManager } from './sessions';

export function createSignalingServer(options: {
  port: number;
  host?: string;
  origins?: string[];
  ttlMs?: number;
}) {
  const sessions = new SessionManager<WebSocket>(options.ttlMs);
  const wss = new WebSocketServer({
    port: options.port,
    host: options.host ?? '127.0.0.1',
    maxPayload: MAX_SIGNAL_BYTES,
    perMessageDeflate: false,
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
  wss.on('connection', (socket, request) => {
    if (
      (options.origins?.length &&
        !options.origins.includes(request.headers.origin ?? '')) ||
      wss.clients.size > 1000
    ) {
      socket.close(1008, 'Origin or capacity policy');
      return;
    }
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
    let windowStart = Date.now();
    let messages = 0;
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
      if (!parsed.success) {
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
      for (const peer of sessions.leave(socket))
        send(peer, { type: 'peer-disconnected' });
    });
  });
  const sweep = setInterval(() => {
    for (const peer of sessions.expire())
      send(peer, { type: 'session-error', reason: 'session-expired' });
    for (const socket of wss.clients) {
      if (!alive.delete(socket)) socket.terminate();
      else socket.ping();
    }
  }, 30_000);
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
