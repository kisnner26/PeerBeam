// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ServerMessage } from '@peerbeam/protocol';
import { useSession } from './useSession';
const mocks = vi.hoisted(() => ({
  message: undefined as ((m: ServerMessage) => void) | undefined,
  lost: undefined as ((m: string) => void) | undefined,
  opened: undefined as ((c: RTCDataChannel) => void) | undefined,
  failed: undefined as ((m: string) => void) | undefined,
  close: vi.fn(),
  teardown: vi.fn(),
}));
vi.mock('./SignalingClient', () => ({
  SignalingClient: class {
    constructor(
      message: (m: ServerMessage) => void,
      lost: (m: string) => void,
    ) {
      mocks.message = message;
      mocks.lost = lost;
    }
    connect = async () => {};
    send = vi.fn();
    close = mocks.close;
  },
}));
vi.mock('./PeerConnectionManager', () => ({
  emptyDetails: {},
  PeerConnectionManager: class {
    constructor(
      _send: unknown,
      opened: (c: RTCDataChannel) => void,
      failed: (m: string) => void,
    ) {
      mocks.opened = opened;
      mocks.failed = failed;
    }
    teardown = mocks.teardown;
    createOffer = async () => {};
    maxMessageSize = 65536;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function setup(open: boolean) {
  const hook = renderHook(useSession);
  await act(() => hook.result.current.start());
  await act(async () => {
    mocks.message?.({ type: 'peer-ready', initiator: true });
  });
  const channel = Object.assign(new EventTarget(), {
    readyState: 'open',
  }) as unknown as RTCDataChannel;
  if (open) act(() => mocks.opened?.(channel));
  return { ...hook, channel };
}
it('fails if signaling closes before the data channel opens', async () => {
  const { result } = await setup(false);
  act(() => mocks.lost?.('WebSocket disconnected.'));
  expect(result.current.status).toBe('error');
  expect(mocks.teardown).toHaveBeenCalled();
});
it('preserves the channel on signaling loss, peer-disconnected and expiry notifications', async () => {
  const { result, channel } = await setup(true);
  mocks.teardown.mockClear();
  act(() => mocks.lost?.('WebSocket disconnected.'));
  await act(async () => {
    mocks.message?.({ type: 'peer-disconnected' });
    mocks.message?.({ type: 'session-error', reason: 'session-expired' });
  });
  expect(result.current.channel).toBe(channel);
  expect(result.current.status).toBe('connected');
  expect(result.current.warning).toContain('continues');
  expect(mocks.teardown).not.toHaveBeenCalled();
  act(() => mocks.failed?.('Data channel closed.'));
  expect(result.current.status).toBe('error');
  expect(mocks.teardown).toHaveBeenCalledOnce();
});
it('leave and unmount still release both transports after signaling loss', async () => {
  const { result, unmount } = await setup(true);
  act(() => mocks.lost?.('closed'));
  act(() => result.current.reset());
  expect(result.current.channel).toBeUndefined();
  expect(result.current.warning).toBe('');
  expect(result.current.status).toBe('idle');
  expect(mocks.teardown).toHaveBeenCalled();
  unmount();
  expect(mocks.close).toHaveBeenCalled();
});
