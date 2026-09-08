import { usePreferences } from '../preferences/Preferences';
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
  const { t } = usePreferences();

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
      <span className="eyebrow cyan">{t('Permission required')}</span>
      <h3 id="incoming-heading">{t('Incoming file')}</h3>
      <p className="filename">{transfer.file.name}</p>
      <p className="muted">
        {formatBytes(transfer.file.size)} {t('· Only accept files you expect.')}
      </p>
      <div className="button-row">
        <button ref={accept} className="button primary" onClick={onAccept}>
          {t('Accept')}
        </button>
        <button className="button secondary" onClick={onReject}>
          {t('Reject')}
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
  const { t } = usePreferences();

  const percent = progress(transfer.bytes, transfer.file.size);
  const labels = {
    offered: t('Waiting for acceptance'),
    accepted: t('Preparing transfer'),
    transferring:
      transfer.direction === 'send' ? t('Sending file') : t('Receiving file'),
    'awaiting-ack': t('Waiting for receiver confirmation'),
    complete: t('Transfer complete'),
    rejected: t('File rejected'),
    cancelled: t('Transfer cancelled'),
    error: t('Transfer interrupted'),
  };
  return (
    <section className="transfer-card" aria-label={t('File transfer')}>
      <div className="transfer-top">
        <div>
          <span className="eyebrow">
            {transfer.direction === 'send' ? t('Outgoing') : t('Incoming')}
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
        aria-label={t('Transfer progress')}
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
          ? `${formatBytes(transfer.speed)}/s ${t('average')}`
          : t('Speed unavailable')}{' '}
        · {transfer.chunks} / {transfer.file.totalChunks} {t('chunks')}
      </p>
      {transfer.error && <p role="alert">{t(transfer.error)}</p>}
      {isActive(transfer.status) && (
        <button className="text-button" onClick={onCancel}>
          {t('Cancel transfer')}
        </button>
      )}
      {transfer.downloadUrl && (
        <a
          className="button primary full"
          href={transfer.downloadUrl}
          download={transfer.file.name}
        >
          {t('Download file')}
          <span aria-hidden="true">↓</span>
        </a>
      )}
    </section>
  );
}
