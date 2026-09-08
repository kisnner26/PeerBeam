import type { FileMetadata } from '@peerbeam/protocol';

export type TransferStatus =
  | 'offered'
  | 'accepted'
  | 'transferring'
  | 'awaiting-ack'
  | 'complete'
  | 'rejected'
  | 'cancelled'
  | 'error';
const transitions: Record<TransferStatus, TransferStatus[]> = {
  offered: ['accepted', 'rejected', 'cancelled', 'error'],
  accepted: ['transferring', 'cancelled', 'error'],
  transferring: ['awaiting-ack', 'complete', 'cancelled', 'error'],
  'awaiting-ack': ['complete', 'cancelled', 'error'],
  complete: [],
  rejected: [],
  cancelled: [],
  error: [],
};
export function transition(
  from: TransferStatus,
  to: TransferStatus,
): TransferStatus {
  if (!transitions[from].includes(to))
    throw new Error(`Invalid transfer transition: ${from} → ${to}`);
  return to;
}
export function isActive(status: TransferStatus) {
  return transitions[status].length > 0;
}
export function chunkCount(size: number, chunkSize: number): number {
  return Math.ceil(size / chunkSize);
}
export function progress(bytes: number, total: number): number {
  return total === 0 ? 100 : Math.min(100, Math.max(0, (bytes / total) * 100));
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 ** 2 ? 1 : bytes < 1024 ** 3 ? 2 : 3;
  return `${(bytes / 1024 ** unit).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB'][unit]}`;
}
export function safeFilename(name: string): string {
  // Control and bidi characters are deliberately stripped from untrusted names.
  // eslint-disable-next-line no-control-regex
  return (
    name
      .replace(
        /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\:*?"<>|]/g,
        '_',
      )
      .replace(/^\.+/, '_')
      .slice(0, 255) || 'download'
  );
}
export interface TransferSnapshot {
  id: string;
  direction: 'send' | 'receive';
  file: FileMetadata;
  status: TransferStatus;
  bytes: number;
  chunks: number;
  speed: number;
  error?: string;
  downloadUrl?: string;
}
