import { afterEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { serverMessageSchema, type ServerMessage } from '@peerbeam/protocol';
import { createSignalingServer } from './server';

const servers: ReturnType<typeof createSignalingServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});
function next(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Message timed out')),
      2000,
    );
    socket.once('message', (raw) => {
      clearTimeout(timeout);
      resolve(serverMessageSchema.parse(JSON.parse(raw.toString())));
    });
  });
}
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
