import {
  CHUNK_SIZE,
  MAX_CONTROL_BYTES,
  fileMessageSchema,
  fileMetadataSchema,
  type FileMessage,
} from '@peerbeam/protocol';
import {
  chunkCount,
  isActive,
  safeFilename,
  transition,
  type TransferSnapshot,
  type TransferStatus,
} from './state';
import { waitForBufferLow } from './backpressure';

export class TransferManager {
  private current?: TransferSnapshot;
  private source?: File;
  private parts: ArrayBuffer[] = [];
  private meta?: Extract<FileMessage, { type: 'chunk-meta' }>;
  private discardBinary = false;
  private readonly retired = new Set<string>();
  private abort = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private disposed = false;
  constructor(
    private readonly channel: RTCDataChannel,
    private readonly publish: (state: TransferSnapshot) => void,
    private readonly onError: (message: string) => void,
    private readonly maxMessageSize = CHUNK_SIZE,
  ) {
    channel.addEventListener('message', this.onMessage);
    channel.addEventListener('close', this.onClose);
  }
  get busy() {
    return !!this.current && isActive(this.current.status);
  }
  offer(file: File) {
    if (this.busy)
      throw new Error('Finish or cancel the current transfer first.');
    const chunkSize = Math.min(CHUNK_SIZE, this.maxMessageSize || CHUNK_SIZE);
    const metadata = fileMetadataSchema.safeParse({
      id: crypto.randomUUID(),
      name: safeFilename(file.name),
      size: file.size,
      mimeType: file.type,
      chunkSize,
      totalChunks: chunkCount(file.size, chunkSize),
    });
    if (!metadata.success)
      throw new Error(
        'This file cannot be transferred. The v0.1 limit is 128 MiB.',
      );
    this.clearPrevious();
    this.source = file;
    this.current = {
      id: crypto.randomUUID(),
      direction: 'send',
      file: metadata.data,
      status: 'offered',
      bytes: 0,
      chunks: 0,
      speed: 0,
    };
    this.send({
      type: 'file-offer',
      transferId: this.current.id,
      file: metadata.data,
    });
    this.emit();
    this.arm(120_000);
  }
  accept() {
    const state = this.current;
    if (!state || state.direction !== 'receive' || state.status !== 'offered')
      return;
    this.setStatus('accepted');
    this.send({ type: 'file-accept', transferId: state.id });
    this.arm();
  }
  reject() {
    if (
      this.current?.direction !== 'receive' ||
      this.current.status !== 'offered'
    )
      return;
    this.send({ type: 'file-reject', transferId: this.current.id });
    this.finish('rejected');
  }
  cancel() {
    if (!this.busy || !this.current) return;
    this.send({ type: 'transfer-cancel', transferId: this.current.id });
    this.finish('cancelled');
  }
  private send(message: FileMessage) {
    if (this.channel.readyState !== 'open')
      throw new Error('Data channel is not open.');
    this.channel.send(JSON.stringify(fileMessageSchema.parse(message)));
  }
  private onMessage = (event: MessageEvent<unknown>) => {
    if (this.disposed) return;
    try {
      if (typeof event.data === 'string') {
        if (new TextEncoder().encode(event.data).length > MAX_CONTROL_BYTES)
          throw new Error('Control message too large.');
        this.handle(fileMessageSchema.parse(JSON.parse(event.data)));
      } else if (event.data instanceof ArrayBuffer)
        this.receiveChunk(event.data);
      else throw new Error('Unsupported data channel message.');
    } catch {
      this.fail('Invalid transfer data. The connection was closed.');
      this.channel.close();
    }
  };
  private handle(message: FileMessage) {
    if (message.type === 'file-offer') {
      if (this.busy || this.retired.has(message.transferId)) {
        this.send({ type: 'file-reject', transferId: message.transferId });
        return;
      }
      this.clearPrevious();
      this.current = {
        id: message.transferId,
        direction: 'receive',
        file: { ...message.file, name: safeFilename(message.file.name) },
        status: 'offered',
        bytes: 0,
        chunks: 0,
        speed: 0,
      };
      this.emit();
      this.arm(120_000);
      return;
    }
    if (this.retired.has(message.transferId)) {
      if (message.type === 'chunk-meta') this.discardBinary = true;
      return;
    }
    const state = this.current;
    if (!state || message.transferId !== state.id || !this.busy)
      throw new Error('Unknown transfer.');
    this.arm();
    switch (message.type) {
      case 'file-accept':
        if (state.direction !== 'send' || state.status !== 'offered')
          throw new Error('Unexpected acceptance.');
        this.setStatus('accepted');
        void this.sendFile().catch((cause: unknown) => {
          if (!this.disposed && this.current === state && this.busy)
            this.fail(
              cause instanceof Error ? cause.message : 'Transfer interrupted.',
            );
        });
        break;
      case 'file-reject':
        if (state.direction !== 'send' || state.status !== 'offered')
          throw new Error('Unexpected rejection.');
        this.finish('rejected');
        break;
      case 'transfer-start':
        if (state.direction !== 'receive' || state.status !== 'accepted')
          throw new Error('Transfer was not accepted.');
        this.startedAt = performance.now();
        this.setStatus('transferring');
        break;
      case 'chunk-meta':
        if (
          state.direction !== 'receive' ||
          state.status !== 'transferring' ||
          this.meta ||
          message.index !== state.chunks ||
          message.size !==
            Math.min(state.file.chunkSize, state.file.size - state.bytes)
        )
          throw new Error('Unexpected chunk.');
        this.meta = message;
        break;
      case 'transfer-complete':
        if (message.phase === 'sent') {
          if (
            state.direction !== 'receive' ||
            state.status !== 'transferring' ||
            this.meta ||
            state.bytes !== state.file.size ||
            state.chunks !== state.file.totalChunks
          )
            throw new Error('Incomplete file.');
          // Always download; never render potentially active received content.
          state.downloadUrl = URL.createObjectURL(
            new Blob(this.parts, { type: 'application/octet-stream' }),
          );
          this.send({
            type: 'transfer-complete',
            transferId: state.id,
            phase: 'ack',
          });
          this.finish('complete');
        } else {
          if (state.direction !== 'send' || state.status !== 'awaiting-ack')
            throw new Error('Unexpected acknowledgement.');
          this.finish('complete');
        }
        break;
      case 'transfer-cancel':
        this.finish('cancelled');
        break;
      case 'transfer-error':
        this.fail('The other device reported a transfer error.', false);
        break;
    }
  }
  private async sendFile() {
    const state = this.current;
    const file = this.source;
    const signal = this.abort.signal;
    if (!state || !file) throw new Error('Source file unavailable.');
    this.send({ type: 'transfer-start', transferId: state.id });
    this.startedAt = performance.now();
    this.setStatus('transferring');
    for (let index = 0; index < state.file.totalChunks; index++) {
      await waitForBufferLow(this.channel, signal);
      signal.throwIfAborted();
      const bytes = await file
        .slice(index * state.file.chunkSize, (index + 1) * state.file.chunkSize)
        .arrayBuffer();
      signal.throwIfAborted();
      this.send({
        type: 'chunk-meta',
        transferId: state.id,
        index,
        size: bytes.byteLength,
      });
      this.channel.send(bytes);
      state.bytes += bytes.byteLength;
      state.chunks++;
      this.measure();
      this.arm();
    }
    await waitForBufferLow(this.channel, signal);
    signal.throwIfAborted();
    this.send({
      type: 'transfer-complete',
      transferId: state.id,
      phase: 'sent',
    });
    this.setStatus('awaiting-ack');
    this.arm();
  }
  private receiveChunk(bytes: ArrayBuffer) {
    if (this.discardBinary) {
      this.discardBinary = false;
      return;
    }
    const state = this.current;
    if (
      !state ||
      state.direction !== 'receive' ||
      state.status !== 'transferring' ||
      !this.meta ||
      bytes.byteLength !== this.meta.size
    )
      throw new Error('Unexpected binary chunk.');
    this.parts.push(bytes);
    state.bytes += bytes.byteLength;
    state.chunks++;
    this.meta = undefined;
    this.measure();
    this.arm();
  }
  private measure() {
    if (this.current)
      this.current.speed =
        this.current.bytes /
        Math.max((performance.now() - this.startedAt) / 1000, 0.001);
    this.emit();
  }
  private setStatus(next: TransferStatus) {
    if (!this.current) return;
    this.current.status = transition(this.current.status, next);
    this.emit();
  }
  private emit() {
    if (this.current && !this.disposed) this.publish({ ...this.current });
  }
  private arm(ms = 30_000) {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.fail('Transfer timed out. Try sending the file again.'),
      ms,
    );
  }
  private finish(status: TransferStatus) {
    clearTimeout(this.timer);
    this.abort.abort();
    this.parts = [];
    this.source = undefined;
    if (this.meta) this.discardBinary = true;
    this.meta = undefined;
    if (this.current) {
      this.retired.add(this.current.id);
      if (this.retired.size > 16)
        this.retired.delete(this.retired.values().next().value!);
      this.setStatus(status);
    }
  }
  private fail(message: string, notify = true) {
    if (this.busy && this.current) {
      if (notify && this.channel.readyState === 'open')
        this.send({
          type: 'transfer-error',
          transferId: this.current.id,
          message: message.slice(0, 200),
        });
      this.current.error = message;
      this.finish('error');
    }
    if (!this.disposed) this.onError(message);
  }
  private onClose = () => {
    if (this.busy) this.fail('Transfer interrupted: peer disconnected.', false);
  };
  private clearPrevious() {
    if (this.current?.downloadUrl)
      URL.revokeObjectURL(this.current.downloadUrl);
    this.abort.abort();
    this.abort = new AbortController();
    this.parts = [];
    this.meta = undefined;
    clearTimeout(this.timer);
  }
  dispose() {
    this.disposed = true;
    this.clearPrevious();
    this.channel.removeEventListener('message', this.onMessage);
    this.channel.removeEventListener('close', this.onClose);
  }
}
