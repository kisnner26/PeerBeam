import { expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  MAX_FILE_SIZE,
  fileMetadataSchema,
  fileMessageSchema,
} from './file';
const file = {
  id: 'd316f535-dfd8-41d3-8275-c3a4bb8cda22',
  name: 'hello.txt',
  size: 12,
  mimeType: 'text/plain',
  chunkSize: CHUNK_SIZE,
  totalChunks: 1,
};
it('validates metadata including empty files', () => {
  expect(fileMetadataSchema.safeParse(file).success).toBe(true);
  expect(
    fileMetadataSchema.safeParse({ ...file, size: 0, totalChunks: 0 }).success,
  ).toBe(true);
});
it.each([
  { size: -1 },
  { size: MAX_FILE_SIZE + 1 },
  { totalChunks: 2 },
  { name: '' },
  { name: 'x'.repeat(256) },
  { chunkSize: 0 },
  { injected: true },
])('rejects invalid metadata %j', (change) => {
  expect(fileMetadataSchema.safeParse({ ...file, ...change }).success).toBe(
    false,
  );
});
it('requires valid transfer IDs and limits chunk sizes', () => {
  expect(
    fileMessageSchema.safeParse({ type: 'file-accept', transferId: 'bad' })
      .success,
  ).toBe(false);
  expect(
    fileMessageSchema.safeParse({
      type: 'chunk-meta',
      transferId: file.id,
      index: 0,
      size: CHUNK_SIZE + 1,
    }).success,
  ).toBe(false);
});
