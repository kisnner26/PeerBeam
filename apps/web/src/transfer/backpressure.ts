export const BUFFER_HIGH = 1024 * 1024;
export const BUFFER_LOW = 256 * 1024;

/** Bound the queue; remove every listener on resolve, abort, close or timeout. */
export function waitForBufferLow(
  channel: RTCDataChannel,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('Transfer cancelled.'));
  if (channel.readyState !== 'open')
    return Promise.reject(new Error('Data channel closed.'));
  if (channel.bufferedAmount <= BUFFER_HIGH) return Promise.resolve();
  channel.bufferedAmountLowThreshold = BUFFER_LOW;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      channel.removeEventListener('bufferedamountlow', low);
      channel.removeEventListener('close', closed);
      channel.removeEventListener('error', closed);
      signal.removeEventListener('abort', aborted);
    };
    const low = () => {
      if (channel.bufferedAmount <= BUFFER_LOW) {
        cleanup();
        resolve();
      }
    };
    const closed = () => {
      cleanup();
      reject(new Error('Data channel closed.'));
    };
    const aborted = () => {
      cleanup();
      reject(new Error('Transfer cancelled.'));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Transfer stalled while waiting for the network.'));
    }, 30_000);
    channel.addEventListener('bufferedamountlow', low);
    channel.addEventListener('close', closed);
    channel.addEventListener('error', closed);
    signal.addEventListener('abort', aborted, { once: true });
    // Recheck after subscribing so a drain between the first check and listener cannot be lost.
    if (signal.aborted) aborted();
    else if (channel.readyState !== 'open') closed();
    else low();
  });
}
