import { afterEach, expect, it, vi } from 'vitest';
import { CHUNK_SIZE, type FileMessage } from '@peerbeam/protocol';
import { TransferManager } from './TransferManager';
import type { TransferSnapshot } from './state';

class Channel extends EventTarget {
  readyState = 'open';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  remote?: Channel;
  sent: (string | ArrayBuffer)[] = [];
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
    queueMicrotask(() =>
      this.remote?.dispatchEvent(new MessageEvent('message', { data })),
    );
  }
  close() {
    this.readyState = 'closed';
    this.dispatchEvent(new Event('close'));
  }
  get rtc() {
    return this as unknown as RTCDataChannel;
  }
}
const instances: TransferManager[] = [];
afterEach(() => {
  instances.splice(0).forEach((manager) => manager.dispose());
  vi.useRealTimers();
});
function pair() {
  const a = new Channel();
  const b = new Channel();
  a.remote = b;
  b.remote = a;
  const states: { a?: TransferSnapshot; b?: TransferSnapshot } = {};
  const error = vi.fn();
  const sender = new TransferManager(
    a.rtc,
    (value) => {
      states.a = value;
    },
    error,
  );
  const receiver = new TransferManager(
    b.rtc,
    (value) => {
      states.b = value;
    },
    error,
  );
  instances.push(sender, receiver);
  return { a, b, states, sender, receiver, error };
}
it.each([0, CHUNK_SIZE * 2 + 37])(
  'transfers %i bytes only after acceptance and confirms exact reconstructed bytes',
  async (size) => {
    const { a, sender, receiver, states, error } = pair();
    const input = Uint8Array.from({ length: size }, (_, i) => i % 251);
    sender.offer(new File([input], 'payload.bin'));
    await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
    expect(a.sent).toHaveLength(1);
    expect(states.a?.bytes).toBe(0);
    receiver.accept();
    await vi.waitFor(() => expect(states.a?.status).toBe('complete'));
    expect(states.b?.status).toBe('complete');
    expect(states.b?.bytes).toBe(size);
    expect(states.b?.chunks).toBe(Math.ceil(size / CHUNK_SIZE));
    const reconstructed = await (
      await fetch(states.b!.downloadUrl!)
    ).arrayBuffer();
    expect(new Uint8Array(reconstructed)).toEqual(input);
    expect(error).not.toHaveBeenCalled();
  },
);
it('rejects without sending binary, then permits another file', async () => {
  const { a, sender, receiver, states } = pair();
  sender.offer(new File(['hello'], 'hello.txt'));
  await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
  receiver.reject();
  await vi.waitFor(() => expect(states.a?.status).toBe('rejected'));
  expect(a.sent.every((message) => typeof message === 'string')).toBe(true);
  sender.offer(new File(['again'], 'again.txt'));
  await vi.waitFor(() => expect(states.b?.file.name).toBe('again.txt'));
});
it('cancels while backpressured and safely discards already queued chunks', async () => {
  const { a, b, sender, receiver, states } = pair();
  a.bufferedAmount = 2 * 1024 * 1024;
  sender.offer(new File(['hello'], 'hello.txt'));
  await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
  receiver.accept();
  await vi.waitFor(() => expect(states.a?.status).toBe('transferring'));
  receiver.cancel();
  await vi.waitFor(() => expect(states.a?.status).toBe('cancelled'));
  const stale: FileMessage = {
    type: 'chunk-meta',
    transferId: states.b!.id,
    index: 0,
    size: 5,
  };
  b.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(stale) }));
  b.dispatchEvent(new MessageEvent('message', { data: new ArrayBuffer(5) }));
  expect(b.readyState).toBe('open');
  expect(states.b?.status).toBe('cancelled');
});
it.each(['unaccepted', 'wrong-index', 'wrong-size', 'early-complete'])(
  'closes on %s payloads',
  async (scenario) => {
    const { b, sender, receiver, states } = pair();
    sender.offer(new File(['hello'], 'hello.txt'));
    await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
    // Isolate the receiver from the legitimate sender to inject protocol violations.
    b.remote = undefined;
    const deliver = (message: FileMessage) =>
      b.dispatchEvent(
        new MessageEvent('message', { data: JSON.stringify(message) }),
      );
    const transferId = states.b!.id;
    if (scenario !== 'unaccepted') receiver.accept();
    deliver({ type: 'transfer-start', transferId });
    if (scenario === 'wrong-index')
      deliver({ type: 'chunk-meta', transferId, index: 1, size: 5 });
    if (scenario === 'wrong-size') {
      deliver({ type: 'chunk-meta', transferId, index: 0, size: 5 });
      b.dispatchEvent(
        new MessageEvent('message', { data: new ArrayBuffer(6) }),
      );
    }
    if (scenario === 'early-complete')
      deliver({ type: 'transfer-complete', transferId, phase: 'sent' });
    expect(b.readyState).toBe('closed');
    expect(states.b?.status).toBe('error');
    expect(states.b?.downloadUrl).toBeUndefined();
  },
);
it('interrupts an active transfer on disconnect and rejects concurrent offers', async () => {
  const { a, sender, states } = pair();
  sender.offer(new File(['x'], 'x'));
  expect(() => sender.offer(new File(['y'], 'y'))).toThrow('Finish or cancel');
  a.close();
  expect(states.a?.status).toBe('error');
});
it('times out an unanswered offer', () => {
  vi.useFakeTimers();
  const { sender, states } = pair();
  sender.offer(new File(['x'], 'x'));
  vi.advanceTimersByTime(120_000);
  expect(states.a?.status).toBe('error');
});
