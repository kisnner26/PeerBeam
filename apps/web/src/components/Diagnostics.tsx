import type { ConnectionDetails } from '../connection/PeerConnectionManager';
import { formatBytes, type TransferSnapshot } from '../transfer/state';

export function Diagnostics({
  details,
  transfer,
}: {
  details: ConnectionDetails;
  transfer?: TransferSnapshot;
}) {
  const rows = [
    ['ICE state', details.ice],
    ['Peer connection', details.peer],
    ['Data channel', details.channel],
    ['Local candidate', details.localCandidate],
    ['Remote candidate', details.remoteCandidate],
    ['Connection type', details.connectionType],
    [
      'Bytes sent',
      details.bytesSent === null
        ? 'Unavailable'
        : `${details.bytesSent.toLocaleString()} B`,
    ],
    [
      'Bytes received',
      details.bytesReceived === null
        ? 'Unavailable'
        : `${details.bytesReceived.toLocaleString()} B`,
    ],
    [
      'Transfer speed',
      transfer?.speed ? `${formatBytes(transfer.speed)}/s avg` : 'Unavailable',
    ],
    [
      'Chunks',
      transfer
        ? `${transfer.chunks} / ${transfer.file.totalChunks}`
        : 'Unavailable',
    ],
  ];
  return (
    <details className="diagnostics">
      <summary>
        <span>
          <span aria-hidden="true" className="code-symbol">
            ⌘
          </span>{' '}
          Connection details
        </span>
        <span className="eyebrow">
          Developer mode <span aria-hidden="true">＋</span>
        </span>
      </summary>
      <p className="fine-print">
        Live WebRTC states and getStats() values. Missing metrics are marked
        unavailable. Byte counters include data channel control messages;
        progress counts file payload only.
      </p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
