import { expect, it } from 'vitest';
import { chunkCount, progress, safeFilename, transition } from './state';
it('calculates chunk boundaries and clamped progress including empty files', () => {
  expect(chunkCount(0, 65536)).toBe(0);
  expect(chunkCount(65536, 65536)).toBe(1);
  expect(chunkCount(65537, 65536)).toBe(2);
  expect(progress(72, 100)).toBe(72);
  expect(progress(200, 100)).toBe(100);
  expect(progress(-1, 100)).toBe(0);
  expect(progress(0, 0)).toBe(100);
});
it('requires acceptance before transfer and prevents reviving a finished transfer', () => {
  expect(() => transition('offered', 'transferring')).toThrow();
  expect(transition('offered', 'accepted')).toBe('accepted');
  expect(transition('transferring', 'awaiting-ack')).toBe('awaiting-ack');
  expect(() => transition('complete', 'transferring')).toThrow();
  expect(transition('offered', 'rejected')).toBe('rejected');
});
it('removes traversal separators, control and bidi characters from filenames', () => {
  expect(safeFilename('../a\\b\u202E\u0000.html')).toBe('__a_b__.html');
  expect(safeFilename('')).toBe('download');
});
