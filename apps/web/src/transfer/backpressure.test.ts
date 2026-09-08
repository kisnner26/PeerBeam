import { afterEach, expect, it, vi } from 'vitest';
import { BUFFER_HIGH, BUFFER_LOW, waitForBufferLow } from './backpressure';
function channel() {
  return Object.assign(new EventTarget(), {
    readyState: 'open',
    bufferedAmount: BUFFER_HIGH + 1,
    bufferedAmountLowThreshold: 0,
  }) as unknown as RTCDataChannel;
}
afterEach(() => vi.useRealTimers());
it('waits until the low threshold and removes listeners', async () => {
  const dc = channel();
  const remove = vi.spyOn(dc, 'removeEventListener');
  let done = false;
  const pending = waitForBufferLow(dc, new AbortController().signal).then(
    () => {
      done = true;
    },
  );
  await Promise.resolve();
  expect(done).toBe(false);
  expect(dc.bufferedAmountLowThreshold).toBe(BUFFER_LOW);
  Object.assign(dc, { bufferedAmount: BUFFER_LOW });
  dc.dispatchEvent(new Event('bufferedamountlow'));
  await pending;
  expect(done).toBe(true);
  expect(remove).toHaveBeenCalledTimes(3);
});
it.each(['abort', 'close', 'timeout'])(
  'rejects a blocked wait on %s',
  async (reason) => {
    vi.useFakeTimers();
    const dc = channel();
    const controller = new AbortController();
    const pending = waitForBufferLow(dc, controller.signal);
    const assertion = expect(pending).rejects.toThrow();
    if (reason === 'abort') controller.abort();
    else if (reason === 'close') dc.dispatchEvent(new Event('close'));
    else vi.advanceTimersByTime(30_000);
    await assertion;
  },
);
