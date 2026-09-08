import { usePreferences } from '../preferences/Preferences';
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
  const { t } = usePreferences();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  return (
    <section className="session-panel" aria-label={t('Connect devices')}>
      <div className="tabs">
        <button
          aria-pressed={mode === 'create'}
          onClick={() => setMode('create')}
          disabled={busy}
        >
          {t('Create session')}
        </button>
        <button
          aria-pressed={mode === 'join'}
          onClick={() => setMode('join')}
          disabled={busy}
        >
          {t('Join session')}
        </button>
      </div>
      {mode === 'create' ? (
        <div className="entry-body">
          <div className="icon-tile">↗</div>
          <h2>
            {t('A small code.')} <br />
            {t('A direct connection.')}
          </h2>
          <p>
            {t(
              'Create a private session, then share its code with your other device.',
            )}
          </p>
          <button
            className="button primary full"
            onClick={onCreate}
            disabled={busy}
          >
            {busy ? t('Connecting…') : t('Create session')}{' '}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="fine-print">
            {t('No account. No installation. Just two devices.')}
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
            {t('Your other device')} <br />
            {t('is one code away.')}
          </h2>
          <p>
            {t('Enter the code shown on the device that created the session.')}
          </p>
          <label className="field-label" htmlFor="session-code">
            {t('Enter session code')}
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
            {busy ? t('Connecting…') : t('Connect')}{' '}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}
    </section>
  );
}
