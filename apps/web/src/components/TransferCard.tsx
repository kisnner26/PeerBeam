import { useEffect, useRef } from 'react';
import {
  formatBytes,
  isActive,
  progress,
  type TransferSnapshot,
} from '../transfer/state';

export function IncomingFile({
  transfer,
  onAccept,
  onReject,
}: {
  transfer: TransferSnapshot;
  onAccept: () => void;
  onReject: () => void;
}) {
  const accept = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    accept.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <section
      className="incoming"
      role="region"
      aria-labelledby="incoming-heading"
    >
      <span className="eyebrow cyan">Permission required</span>
      <h3 id="incoming-heading">Incoming file</h3>
      <p className="filename">{transfer.file.name}</p>
      <p className="muted">
        {formatBytes(transfer.file.size)} · Only accept files you expect.
      </p>
      <div className="button-row">
        <button ref={accept} className="button primary" onClick={onAccept}>
          Accept
        </button>
        <button className="button secondary" onClick={onReject}>
          Reject
        </button>
      </div>
    </section>
  );
}
export function TransferCard({
  transfer,
  onCancel,
}: {
  transfer: TransferSnapshot;
  onCancel: () => void;
}) {
  const percent = progress(transfer.bytes, transfer.file.size);
  const labels = {
    offered: 'Waiting for acceptance',
    accepted: 'Preparing transfer',
    transferring:
      transfer.direction === 'send' ? 'Sending file' : 'Receiving file',
    'awaiting-ack': 'Waiting for receiver confirmation',
    complete: 'Transfer complete',
    rejected: 'File rejected',
    cancelled: 'Transfer cancelled',
    error: 'Transfer interrupted',
  };
  return (
    <section className="transfer-card" aria-label="File transfer">
      <div className="transfer-top">
        <div>
          <span className="eyebrow">
            {transfer.direction === 'send' ? 'Outgoing' : 'Incoming'}
          </span>
          <h3 className="filename">{transfer.file.name}</h3>
        </div>
        <span className="file-glyph" aria-hidden="true">
          ↗
        </span>
      </div>
      <p
        role="status"
        className={transfer.status === 'complete' ? 'cyan' : 'muted'}
      >
        {transfer.status === 'complete' && '✓ '}
        {labels[transfer.status]}
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Transfer progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-labels">
        <span>
          {formatBytes(transfer.bytes)} / {formatBytes(transfer.file.size)}
        </span>
        <strong>{Math.round(percent)}%</strong>
      </div>
      <p className="fine-print">
        {transfer.speed > 0
          ? `${formatBytes(transfer.speed)}/s average`
          : 'Speed unavailable'}{' '}
        · {transfer.chunks} / {transfer.file.totalChunks} chunks
      </p>
      {transfer.error && <p role="alert">{transfer.error}</p>}
      {isActive(transfer.status) && (
        <button className="text-button" onClick={onCancel}>
          Cancel transfer
        </button>
      )}
      {transfer.downloadUrl && (
        <a
          className="button primary full"
          href={transfer.downloadUrl}
          download={transfer.file.name}
        >
          Download file <span aria-hidden="true">↓</span>
        </a>
      )}
    </section>
  );
}
