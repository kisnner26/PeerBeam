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
  vi.restoreAllMocks();
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

function deliver(channel: Channel, message: FileMessage | ArrayBuffer) {
  channel.dispatchEvent(
    new MessageEvent('message', {
      data: message instanceof ArrayBuffer ? message : JSON.stringify(message),
    }),
  );
}
async function incoming() {
  const fixture = pair();
  fixture.sender.offer(new File(['hello'], 'hello.txt'));
  await vi.waitFor(() => expect(fixture.states.b?.status).toBe('offered'));
  fixture.b.remote = undefined;
  return { ...fixture, transferId: fixture.states.b!.id };
}
it.each(['accept', 'cancel', 'reject'] as const)(
  'cleans up when channel closes during %s',
  async (operation) => {
    const { b, receiver, states } = await incoming();
    vi.spyOn(b, 'send').mockImplementation(() => {
      b.close();
      throw new Error('closed');
    });
    expect(() => receiver[operation]()).not.toThrow();
    expect(states.b?.status).toBe(
      operation === 'accept'
        ? 'error'
        : operation === 'cancel'
          ? 'cancelled'
          : 'rejected',
    );
    expect(receiver.busy).toBe(false);
    receiver.accept();
    expect(receiver.busy).toBe(false);
  },
);
it('accept send failure without close still terminates locally', async () => {
  const { b, receiver, states } = await incoming();
  vi.spyOn(b, 'send').mockImplementation(() => {
    throw new Error('send failed');
  });
  receiver.accept();
  expect(states.b?.status).toBe('error');
});
it('close while awaiting acknowledgement ends in error', async () => {
  const { a, sender, states } = pair();
  a.remote = undefined;
  sender.offer(new File([], 'empty'));
  deliver(a, { type: 'file-accept', transferId: states.a!.id });
  await vi.waitFor(() => expect(states.a?.status).toBe('awaiting-ack'));
  a.close();
  expect(states.a?.status).toBe('error');
});
it.each(['cancel-first', 'complete-first'])(
  'keeps terminal decisions stable for %s',
  async (order) => {
    const { b, receiver, states, transferId } = await incoming();
    receiver.accept();
    deliver(b, { type: 'transfer-start', transferId });
    deliver(b, { type: 'chunk-meta', transferId, index: 0, size: 5 });
    deliver(b, new ArrayBuffer(5));
    if (order === 'cancel-first') receiver.cancel();
    deliver(b, { type: 'transfer-complete', transferId, phase: 'sent' });
    receiver.cancel();
    expect(states.b?.status).toBe(
      order === 'cancel-first' ? 'cancelled' : 'complete',
    );
    expect(
      b.sent.filter(
        (x) => typeof x === 'string' && x.includes('"phase":"ack"'),
      ),
    ).toHaveLength(order === 'cancel-first' ? 0 : 1);
  },
);
it('stale metadata cannot consume binary from the next transfer', async () => {
  const { b, receiver, states, transferId } = await incoming();
  receiver.cancel();
  deliver(b, { type: 'chunk-meta', transferId, index: 0, size: 5 });
  const newId = crypto.randomUUID();
  deliver(b, { type: 'file-offer', transferId: newId, file: states.b!.file });
  expect(b.readyState).toBe('closed');
  expect(states.b?.id).toBe(transferId);
});
it('rejects bare stale binary after cancellation', async () => {
  const { b, receiver } = await incoming();
  receiver.cancel();
  deliver(b, new ArrayBuffer(5));
  expect(b.readyState).toBe('closed');
});
it.each(['cancelled', 'complete'] as const)(
  'allows new transfer after %s and revokes old download',
  async (terminal) => {
    const { sender, receiver, states } = pair();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    sender.offer(new File([], 'first'));
    await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
    if (terminal === 'complete') receiver.accept();
    else receiver.cancel();
    await vi.waitFor(() => expect(states.a?.status).toBe(terminal));
    const oldUrl = states.b?.downloadUrl;
    sender.offer(new File(['next'], 'second'));
    await vi.waitFor(() => expect(states.b?.file.name).toBe('second'));
    expect(states.b?.status).toBe('offered');
    if (oldUrl) expect(revoke).toHaveBeenCalledWith(oldUrl);
  },
);
it('dispose during an asynchronous read aborts sends and removes handlers', async () => {
  const { a, sender, states } = pair();
  a.remote = undefined;
  let finishRead!: (value: ArrayBuffer) => void;
  const read = vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const remove = vi.spyOn(a, 'removeEventListener');
  sender.offer(new File(['hello'], 'file'));
  deliver(a, { type: 'file-accept', transferId: states.a!.id });
  await vi.waitFor(() => expect(read).toHaveBeenCalled());
  sender.dispose();
  const count = a.sent.length;
  finishRead(new ArrayBuffer(5));
  await Promise.resolve();
  await Promise.resolve();
  expect(a.sent).toHaveLength(count);
  expect(sender.busy).toBe(false);
  expect(remove.mock.calls.map(([event]) => event)).toEqual(
    expect.arrayContaining(['message', 'close', 'error']),
  );
  expect(() => sender.offer(new File([], 'new'))).toThrow('not open');
});
it('an old timeout callback cannot fail a new transfer', () => {
  vi.useFakeTimers();
  const scheduled = vi.spyOn(globalThis, 'setTimeout');
  const { a, sender, states } = pair();
  a.remote = undefined;
  sender.offer(new File([], 'first'));
  const oldCallback = scheduled.mock.calls.at(-1)![0] as () => void;
  sender.cancel();
  sender.offer(new File([], 'second'));
  oldCallback();
  expect(states.a?.status).toBe('offered');
  expect(states.a?.file.name).toBe('second');
});
it.each(['transfer-complete', 'chunk-meta'] as const)(
  'rejects duplicate %s after completion without acknowledging twice',
  async (type) => {
    const { sender, receiver, b, states } = pair();
    sender.offer(new File([], 'empty'));
    await vi.waitFor(() => expect(states.b?.status).toBe('offered'));
    receiver.accept();
    await vi.waitFor(() => expect(states.a?.status).toBe('complete'));
    const transferId = states.b!.id;
    deliver(
      b,
      type === 'transfer-complete'
        ? { type, transferId, phase: 'sent' }
        : { type, transferId, index: 0, size: 1 },
    );
    expect(b.readyState).toBe('closed');
    expect(states.b?.status).toBe('complete');
    expect(
      b.sent.filter(
        (x) => typeof x === 'string' && x.includes('"phase":"ack"'),
      ),
    ).toHaveLength(1);
  },
);
it('revokes a download when acknowledgement send fails and handles channel errors', async () => {
  const { b, receiver, states, transferId } = await incoming();
  receiver.accept();
  deliver(b, { type: 'transfer-start', transferId });
  deliver(b, { type: 'chunk-meta', transferId, index: 0, size: 5 });
  deliver(b, new ArrayBuffer(5));
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  vi.spyOn(b, 'send').mockImplementation(() => {
    throw new Error('send failed');
  });
  deliver(b, { type: 'transfer-complete', transferId, phase: 'sent' });
  expect(states.b?.status).toBe('error');
  expect(states.b?.downloadUrl).toBeUndefined();
  expect(revoke).toHaveBeenCalledTimes(1);
  const other = pair();
  other.sender.offer(new File([], 'empty'));
  other.a.dispatchEvent(new Event('error'));
  expect(other.states.a?.status).toBe('error');
});
