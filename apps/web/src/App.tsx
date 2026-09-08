import { usePreferences, PreferenceControls } from './preferences/Preferences';
import { useState } from 'react';
import { useSession } from './connection/useSession';
import { useTransfer } from './transfer/useTransfer';
import { SessionEntry } from './components/SessionEntry';
import { IncomingFile, TransferCard } from './components/TransferCard';
import { Diagnostics } from './components/Diagnostics';

function BeamMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 24V8h9a6 6 0 010 12H6M13 25l12-18M19 25l8-12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function App() {
  const { t } = usePreferences();

  const session = useSession();
  const files = useTransfer(session.channel, session.maxMessageSize);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState('');
  const [dragging, setDragging] = useState(false);
  const connected = session.status === 'connected';
  const statusLabel = {
    idle: t('Ready when you are'),
    connecting: t('Reaching signaling server'),
    waiting: t('Waiting for another device'),
    negotiating: t('Connecting to your peer'),
    connected: t('Peer connected'),
    error: t('Connection ended'),
  }[session.status];
  function choose(list: FileList | null) {
    setLocalError('');
    if (!list?.length) return;
    if (list.length !== 1) {
      setLocalError('Choose one file at a time in v0.1.');
      return;
    }
    files.offer(list[0]!);
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      setLocalError('');
    } catch {
      setLocalError('Could not copy. Select and copy the code manually.');
    }
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="." aria-label={t('PeerBeam home')}>
          <span className="logo">
            <BeamMark />
          </span>
          peerbeam<span className="version">v0.1</span>
        </a>
        <div className="header-actions">
          <span className="header-note">
            <span className="tiny-dot" />
            {t('Open source. Open by design.')}
          </span>
          <PreferenceControls />
        </div>
      </header>
      <main>
        <div className="hero-grid">
          <section className="hero-copy">
            <div className="eyebrow intro-tag">
              <span className="tiny-dot" />
              {t('DEVICE TO DEVICE. NOTHING IN BETWEEN.*')}
            </div>
            <h1>
              {t('Your files.')}
              <br />
              {t('A direct line.')}
              <br />
              <span>{t('That’s it.')}</span>
            </h1>
            <p className="tagline">
              {t('P2P file transfer you can actually inspect.')}
            </p>
            <p className="hero-description">
              {t('Connect two browsers. Share a file.')}
              <br className="desktop-break" />
              {t('See exactly how it gets there.')}
            </p>
            <div className="connection-art" aria-hidden="true">
              <div className="device">
                <svg viewBox="0 0 48 48">
                  <rect x="9" y="9" width="30" height="23" rx="3" />
                  <path d="M4 38h40M19 32v6m10-6v6" />
                </svg>
                <span>{t('Your device')}</span>
              </div>
              <div className="beam-line">
                <span className="beam-label">WebRTC / DTLS</span>
                <div className="beam-track">
                  <i />
                  <b>↗</b>
                  <i />
                </div>
                <span className="beam-caption">
                  {t('One peer. One connection.')}
                </span>
              </div>
              <div className="device other">
                <svg viewBox="0 0 48 48">
                  <rect x="14" y="5" width="21" height="37" rx="4" />
                  <path d="M22 36h5" />
                </svg>
                <span>{t('Other device')}</span>
              </div>
            </div>
            <p className="architecture-note">
              {t(
                '* File bytes travel over WebRTC. A small signaling server helps the browsers find each other.',
              )}
            </p>
          </section>
          <div className="workspace">
            <div className="workspace-status">
              <span className={`status-dot ${connected ? 'live' : ''}`} />
              <span role="status">{statusLabel}</span>
              <span className="session-label">{t('01 / CONNECT')}</span>
            </div>
            {(session.error || files.error || localError) && (
              <div className="error-banner" role="alert">
                {t(session.error || files.error || localError)}
              </div>
            )}
            {session.status === 'idle' ||
            session.status === 'error' ||
            session.status === 'connecting' ? (
              <SessionEntry
                onCreate={() => {
                  setCopied(false);
                  void session.start();
                }}
                onJoin={(code) => {
                  setCopied(false);
                  void session.start(code);
                }}
                busy={session.status === 'connecting'}
              />
            ) : (
              <section className="session-panel active-panel">
                <div className="session-heading">
                  <span className="eyebrow">{t('Your code')}</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      session.reset();
                      setLocalError('');
                      setCopied(false);
                    }}
                  >
                    {t('Leave session')}
                  </button>
                </div>
                <div className="share-code">
                  <strong>{session.code}</strong>
                  <button
                    className="button secondary"
                    onClick={() => {
                      void copyCode();
                    }}
                  >
                    {copied ? t('Copied ✓') : t('Copy code')}
                  </button>
                </div>
                {!connected ? (
                  <div className="waiting">
                    <span className="waiting-ring" />
                    <h2>
                      {session.status === 'negotiating'
                        ? t('Making a direct connection…')
                        : t('Bring your other device.')}
                    </h2>
                    <p>
                      {t(
                        'Open PeerBeam there, choose Join session, and enter this code.',
                      )}
                    </p>
                    <p className="fine-print">
                      {t('Waiting codes expire after 10 minutes.')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className={`drop-zone ${dragging ? 'dragging' : ''} ${files.busy ? 'busy' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!files.busy) setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        if (!files.busy) choose(event.dataTransfer.files);
                      }}
                    >
                      <div className="upload-icon" aria-hidden="true">
                        ↑
                      </div>
                      <h2>{t('Drop a file here')}</h2>
                      <p>{t('or choose one from your device')}</p>
                      <label
                        className={`button secondary file-picker ${files.busy ? 'disabled' : ''}`}
                      >
                        {t('Choose file')}
                        <input
                          aria-label={t('Choose file')}
                          type="file"
                          disabled={files.busy}
                          onChange={(event) => {
                            choose(event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <p className="fine-print">
                        {t('One file at a time · Up to 128 MiB')}
                      </p>
                    </div>
                    {files.transfer?.direction === 'receive' &&
                    files.transfer.status === 'offered' ? (
                      <IncomingFile
                        transfer={files.transfer}
                        onAccept={files.accept}
                        onReject={files.reject}
                      />
                    ) : (
                      files.transfer && (
                        <TransferCard
                          transfer={files.transfer}
                          onCancel={files.cancel}
                        />
                      )
                    )}
                  </>
                )}
              </section>
            )}
            <div className="privacy-caption">
              <span aria-hidden="true">◇</span>
              {t('Files never pass through the signaling server.')}
            </div>
          </div>
        </div>
        <Diagnostics details={session.details} transfer={files.transfer} />
        <section className="principles" aria-label={t('PeerBeam principles')}>
          <article>
            <span className="principle-number">01</span>
            <div>
              <h3>{t('Direct by default')}</h3>
              <p>
                {t(
                  'Your file moves between browsers over an encrypted WebRTC channel.',
                )}
              </p>
            </div>
          </article>
          <article>
            <span className="principle-number">02</span>
            <div>
              <h3>{t('Permission comes first')}</h3>
              <p>
                {t('Nothing starts until the other person accepts the file.')}
              </p>
            </div>
          </article>
          <article>
            <span className="principle-number">03</span>
            <div>
              <h3>{t('No black boxes')}</h3>
              <p>
                {t(
                  'Inspect connection states, chunks, and transfer speed as they happen.',
                )}
              </p>
            </div>
          </article>
        </section>
      </main>
      <footer>
        <span>
          peerbeam{' '}
          <span className="muted">{t('/ built to be understood.')}</span>
        </span>
        <span>
          {t('Two devices. Zero accounts.')}{' '}
          <span className="footer-license">{t('MIT licensed.')}</span>
        </span>
      </footer>
    </div>
  );
}
