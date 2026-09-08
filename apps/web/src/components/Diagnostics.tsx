import { usePreferences } from '../preferences/Preferences';
import type { ConnectionDetails } from '../connection/PeerConnectionManager';
import { formatBytes, type TransferSnapshot } from '../transfer/state';

export function Diagnostics({
  details,
  transfer,
}: {
  details: ConnectionDetails;
  transfer?: TransferSnapshot;
}) {
  const { t, language } = usePreferences();

  const rows = [
    [t('ICE state'), details.ice],
    [t('Peer connection'), details.peer],
    [t('Data channel'), details.channel],
    [t('Local candidate'), details.localCandidate],
    [t('Remote candidate'), details.remoteCandidate],
    [t('Connection type'), details.connectionType],
    [
      t('Bytes sent'),
      details.bytesSent === null
        ? t('Unavailable')
        : `${details.bytesSent.toLocaleString(language)} B`,
    ],
    [
      t('Bytes received'),
      details.bytesReceived === null
        ? t('Unavailable')
        : `${details.bytesReceived.toLocaleString(language)} B`,
    ],
    [
      t('Transfer speed'),
      transfer?.speed
        ? `${formatBytes(transfer.speed)}/s ${t('avg')}`
        : t('Unavailable'),
    ],
    [
      t('Chunks'),
      transfer
        ? `${transfer.chunks} / ${transfer.file.totalChunks}`
        : t('Unavailable'),
    ],
  ];
  return (
    <details className="diagnostics">
      <summary>
        <span>
          <span aria-hidden="true" className="code-symbol">
            ⌘
          </span>{' '}
          {t('Connection details')}
        </span>
        <span className="eyebrow">
          {t('Developer mode')}
          <span aria-hidden="true">＋</span>
        </span>
      </summary>
      <p className="fine-print">
        {t(
          'Live WebRTC states and getStats() values. Missing metrics are marked unavailable. Byte counters include data channel control messages; progress counts file payload only.',
        )}
      </p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{t(value ?? '')}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
