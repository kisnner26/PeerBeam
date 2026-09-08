// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionEntry } from './SessionEntry';
import { IncomingFile, TransferCard } from './TransferCard';
import { Diagnostics } from './Diagnostics';
import { emptyDetails } from '../connection/PeerConnectionManager';
import type { TransferSnapshot } from '../transfer/state';
afterEach(cleanup);
const transfer: TransferSnapshot = {
  id: 'example',
  direction: 'receive',
  file: {
    id: 'example',
    name: '<script>alert(1)</script>.txt',
    size: 100,
    mimeType: 'text/plain',
    chunkSize: 65536,
    totalChunks: 1,
  },
  status: 'offered',
  bytes: 72,
  chunks: 0,
  speed: 18,
};
it('creates a session from the primary action', async () => {
  const onCreate = vi.fn();
  render(<SessionEntry onCreate={onCreate} onJoin={vi.fn()} busy={false} />);
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Create session' })[1]!,
  );
  expect(onCreate).toHaveBeenCalledOnce();
});
it('joins with a normalized code and disables incomplete input', async () => {
  const onJoin = vi.fn();
  render(<SessionEntry onCreate={vi.fn()} onJoin={onJoin} busy={false} />);
  await userEvent.click(screen.getByRole('button', { name: 'Join session' }));
  expect(screen.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Enter session code'), 'b7k4q2');
  await userEvent.click(screen.getByRole('button', { name: /Connect/ }));
  expect(onJoin).toHaveBeenCalledWith('B7K4Q2');
});
it('requires explicit acceptance, focuses the action and renders file names as text', async () => {
  const accept = vi.fn();
  const reject = vi.fn();
  render(
    <IncomingFile transfer={transfer} onAccept={accept} onReject={reject} />,
  );
  expect(accept).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Accept' })).toHaveFocus();
  expect(screen.getByText(transfer.file.name)).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
  expect(reject).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
  expect(accept).toHaveBeenCalledOnce();
});
it('reports actual progress and only provides download after completion', () => {
  const { rerender } = render(
    <TransferCard
      transfer={{ ...transfer, status: 'transferring' }}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '72',
  );
  expect(screen.queryByRole('link')).toBeNull();
  rerender(
    <TransferCard
      transfer={{
        ...transfer,
        status: 'complete',
        bytes: 100,
        downloadUrl: 'blob:example',
      }}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole('link')).toHaveAttribute(
    'download',
    transfer.file.name,
  );
});
it('does not invent unavailable diagnostic values', () => {
  render(<Diagnostics details={emptyDetails} />);
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(3);
  expect(screen.getByText('unknown')).toBeInTheDocument();
});
