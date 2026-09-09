import { afterEach, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { serverMessageSchema, type ServerMessage } from '@peerbeam/protocol';
import { createSignalingServer } from './server';
import { JOIN_WINDOW_MS } from './joinLimiter';

const servers: ReturnType<typeof createSignalingServer>[] = [];
async function startServer(
  options: Partial<Parameters<typeof createSignalingServer>[0]> = {},
) {
  const server = createSignalingServer({ port: 0, ...options });
  servers.push(server);
  await new Promise<void>((resolve) => server.wss.once('listening', resolve));
  const address = server.wss.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing address');
  const connect = async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return socket;
  };
  return { server, connect, url: `ws://127.0.0.1:${address.port}` };
}
async function exchange(socket: WebSocket, message: unknown) {
  const pending = next(socket);
  socket.send(JSON.stringify(message));
  return pending;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});
function next(
  socket: WebSocket,
  type?: ServerMessage['type'],
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Message timed out')),
      2000,
    );
    socket.on('message', function receive(raw) {
      const message = serverMessageSchema.parse(JSON.parse(raw.toString()));
      if (type && message.type !== type) return;
      clearTimeout(timeout);
      socket.off('message', receive);
      resolve(message);
    });
  });
}
it('limits failed joins including malformed codes, resets the window and preserves other operations', async () => {
  let now = 0;
  const { connect } = await startServer({ now: () => now });
  const owner = await connect();
  const guest = await connect();
  const room = await exchange(owner, { type: 'create-session' });
  if (room.type !== 'session-created') throw new Error('Missing session');
  expect(
    await exchange(guest, { type: 'join-session', code: 'bad' }),
  ).toMatchObject({ reason: 'invalid-message' });
  for (let i = 0; i < 4; i++)
    expect(
      await exchange(guest, { type: 'join-session', code: 'ZZZZZZZZ' }),
    ).toMatchObject({ reason: 'session-not-found' });
  expect(
    await exchange(guest, { type: 'join-session', code: room.code }),
  ).toMatchObject({ reason: 'rate-limited' });
  expect(await exchange(guest, { type: 'ping' })).toEqual({ type: 'pong' });
  now = JOIN_WINDOW_MS;
  expect(
    await exchange(guest, { type: 'join-session', code: room.code }),
  ).toMatchObject({ type: 'session-joined' });
  const third = await connect();
  for (let i = 0; i < 5; i++)
    await exchange(third, { type: 'join-session', code: 'ZZZZZZZZ' });
  expect(await exchange(third, { type: 'create-session' })).toMatchObject({
    type: 'session-created',
  });
});
it('allows a valid join below the failure budget', async () => {
  const { connect } = await startServer();
  const a = await connect();
  const b = await connect();
  const room = await exchange(a, { type: 'create-session' });
  if (room.type !== 'session-created') throw new Error('Missing session');
  await exchange(b, { type: 'join-session', code: 'ZZZZZZZZ' });
  expect(
    await exchange(b, { type: 'join-session', code: room.code }),
  ).toMatchObject({ type: 'session-joined' });
});
it('rejects the extra socket before upgrade and recovers its capacity', async () => {
  const { server, connect, url } = await startServer({ maxSockets: 2 });
  const a = await connect();
  await connect();
  const extra = new WebSocket(url);
  await new Promise<void>((resolve) => extra.once('error', () => resolve()));
  expect(server.wss.clients.size).toBe(2);
  a.close();
  await vi.waitFor(() => expect(server.wss.clients.size).toBe(1));
  await connect();
  expect(server.wss.clients.size).toBe(2);
});
it('expires both connected peers and clears memberships and sockets', async () => {
  let now = 0;
  const { server, connect } = await startServer({
    ttlMs: 100,
    absoluteTtlMs: 1000,
    now: () => now,
    sweepMs: 20,
  });
  const a = await connect();
  const b = await connect();
  const room = await exchange(a, { type: 'create-session' });
  if (room.type !== 'session-created') throw new Error('Missing room');
  await exchange(b, { type: 'join-session', code: room.code });
  const expiredA = next(a, 'session-error');
  const expiredB = next(b, 'session-error');
  now = 1000;
  expect(await expiredA).toMatchObject({ reason: 'session-expired' });
  expect(await expiredB).toMatchObject({ reason: 'session-expired' });
  await vi.waitFor(() => expect(server.wss.clients.size).toBe(0));
  expect(server.sessions.expire()).toEqual([]);
});
it('expires sockets that never create or join a session despite ping messages', async () => {
  let now = 0;
  const { server, connect } = await startServer({
    ttlMs: 100,
    now: () => now,
    sweepMs: 20,
  });
  const a = await connect();
  await exchange(a, { type: 'ping' });
  const expired = next(a);
  now = 100;
  expect(await expired).toMatchObject({ reason: 'session-expired' });
  await vi.waitFor(() => expect(server.wss.clients.size).toBe(0));
});
it('relays signaling only to the paired peer and rejects malformed/binary data', async () => {
  const server = createSignalingServer({ port: 0 });
  servers.push(server);
  await new Promise<void>((resolve) => server.wss.once('listening', resolve));
  const address = server.wss.address();
  if (typeof address === 'string' || !address)
    throw new Error('No server port');
  const connect = async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    await new Promise<void>((resolve) => socket.once('open', resolve));
    return socket;
  };
  const a = await connect();
  const b = await connect();
  let pending = next(a);
  a.send(JSON.stringify({ type: 'create-session' }));
  const created = await pending;
  if (created.type !== 'session-created') throw new Error('Wrong response');
  const ready = next(a);
  pending = next(b);
  b.send(JSON.stringify({ type: 'join-session', code: created.code }));
  expect((await pending).type).toBe('session-joined');
  expect(await ready).toEqual({ type: 'peer-ready', initiator: true });
  pending = next(b);
  a.send(JSON.stringify({ type: 'offer', sdp: { type: 'offer', sdp: 'v=0' } }));
  expect((await pending).type).toBe('offer');
  pending = next(a);
  a.send(Buffer.from([1, 2, 3]));
  expect(await pending).toEqual({
    type: 'session-error',
    reason: 'invalid-message',
  });
  pending = next(a);
  a.send('{');
  expect((await pending).type).toBe('session-error');
  pending = next(a);
  b.close();
  expect(await pending).toEqual({ type: 'peer-disconnected' });
});
