import { useState } from 'react';
import { normalizeCode } from '@peerbeam/shared';

export function SessionEntry({
  onCreate,
  onJoin,
  busy,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  return (
    <section className="session-panel" aria-label="Connect devices">
      <div className="tabs">
        <button
          aria-pressed={mode === 'create'}
          onClick={() => setMode('create')}
          disabled={busy}
        >
          Create session
        </button>
        <button
          aria-pressed={mode === 'join'}
          onClick={() => setMode('join')}
          disabled={busy}
        >
          Join session
        </button>
      </div>
      {mode === 'create' ? (
        <div className="entry-body">
          <div className="icon-tile">↗</div>
          <h2>
            A small code.
            <br />A direct connection.
          </h2>
          <p>
            Create a private session, then share its code with your other
            device.
          </p>
          <button
            className="button primary full"
            onClick={onCreate}
            disabled={busy}
          >
            {busy ? 'Connecting…' : 'Create session'}{' '}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="fine-print">
            No account. No installation. Just two devices.
          </p>
        </div>
      ) : (
        <form
          className="entry-body"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(code);
          }}
        >
          <div className="icon-tile">↙</div>
          <h2>
            Your other device
            <br />
            is one code away.
          </h2>
          <p>Enter the code shown on the device that created the session.</p>
          <label className="field-label" htmlFor="session-code">
            Enter session code
          </label>
          <input
            id="session-code"
            className="code-input"
            placeholder="B7K4Q2"
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            required
            disabled={busy}
          />
          <button
            className="button primary full"
            disabled={busy || code.length !== 6}
          >
            {busy ? 'Connecting…' : 'Connect'} <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}
    </section>
  );
}
