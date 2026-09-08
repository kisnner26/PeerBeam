import { useEffect, useRef, useState } from 'react';
import { TransferManager } from './TransferManager';
import { isActive, type TransferSnapshot } from './state';

export function useTransfer(
  channel: RTCDataChannel | undefined,
  maxMessageSize: number,
) {
  const manager = useRef<TransferManager | null>(null);
  const [transfer, setTransfer] = useState<TransferSnapshot>();
  const [error, setError] = useState('');
  useEffect(() => {
    setTransfer(undefined);
    setError('');
    if (!channel) return;
    const instance = new TransferManager(
      channel,
      setTransfer,
      setError,
      maxMessageSize,
    );
    manager.current = instance;
    return () => {
      instance.dispose();
      manager.current = null;
    };
  }, [channel, maxMessageSize]);
  function perform(action: (instance: TransferManager) => void) {
    setError('');
    try {
      if (!manager.current)
        throw new Error('Connect a device before sending a file.');
      action(manager.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transfer failed.');
    }
  }
  return {
    transfer,
    error,
    busy: transfer ? isActive(transfer.status) : false,
    offer: (file: File) => perform((instance) => instance.offer(file)),
    accept: () => perform((instance) => instance.accept()),
    reject: () => perform((instance) => instance.reject()),
    cancel: () => perform((instance) => instance.cancel()),
  };
}
