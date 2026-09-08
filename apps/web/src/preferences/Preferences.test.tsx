// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { PreferencesProvider, PreferenceControls } from './Preferences';
import { IncomingFile, TransferCard } from '../components/TransferCard';
import { Diagnostics } from '../components/Diagnostics';
import { emptyDetails } from '../connection/PeerConnectionManager';
import type { TransferSnapshot } from '../transfer/state';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('switches both ways without losing the code being entered', async () => {
  render(
    <PreferencesProvider>
      <App />
    </PreferencesProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Join session' }));
  await userEvent.type(screen.getByLabelText('Enter session code'), 'B7K4Q2');
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Language' }),
    'es',
  );
  expect(screen.getByLabelText('Código de la sesión')).toHaveValue('B7K4Q2');
  expect(document.documentElement.lang).toBe('es');
  expect(screen.getByRole('button', { name: 'Conectar' })).toBeEnabled();
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Idioma' }),
    'en',
  );
  expect(screen.getByLabelText('Enter session code')).toHaveValue('B7K4Q2');
  expect(document.documentElement.lang).toBe('en');
});
it('restores language and theme after remount and can return to night mode', async () => {
  const first = render(
    <PreferencesProvider>
      <App />
    </PreferencesProvider>,
  );
  await userEvent.selectOptions(screen.getByRole('combobox'), 'es');
  await userEvent.click(
    screen.getByRole('button', { name: 'Cambiar a modo día' }),
  );
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('peerbeam.language')).toBe('es');
  expect(localStorage.getItem('peerbeam.theme')).toBe('light');
  first.unmount();
  render(
    <PreferencesProvider>
      <App />
    </PreferencesProvider>,
  );
  expect(screen.getByRole('combobox')).toHaveValue('es');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  await userEvent.click(
    screen.getByRole('button', { name: 'Cambiar a modo noche' }),
  );
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});
it('works when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  render(
    <PreferencesProvider>
      <PreferenceControls />
    </PreferencesProvider>,
  );
  await userEvent.selectOptions(screen.getByRole('combobox'), 'es');
  await userEvent.click(
    screen.getByRole('button', { name: 'Cambiar a modo día' }),
  );
  expect(document.documentElement).toHaveAttribute('lang', 'es');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});
it('translates consent, progress, errors and diagnostics without altering filenames', () => {
  localStorage.setItem('peerbeam.language', 'es');
  const transfer: TransferSnapshot = {
    id: 'example',
    direction: 'receive',
    file: {
      id: 'example',
      name: 'Original English.txt',
      size: 100,
      mimeType: 'text/plain',
      chunkSize: 65536,
      totalChunks: 1,
    },
    status: 'error',
    bytes: 50,
    chunks: 0,
    speed: 10,
    error: 'Data channel closed.',
  };
  render(
    <PreferencesProvider>
      <IncomingFile transfer={transfer} onAccept={vi.fn()} onReject={vi.fn()} />
      <TransferCard transfer={transfer} onCancel={vi.fn()} />
      <Diagnostics details={emptyDetails} transfer={transfer} />
    </PreferencesProvider>,
  );
  expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
  expect(
    screen.getByRole('progressbar', { name: 'Progreso de la transferencia' }),
  ).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Canal de datos cerrado.',
  );
  expect(screen.getAllByText('Original English.txt')).toHaveLength(2);
  expect(screen.getAllByText('No disponible').length).toBeGreaterThan(1);
});
