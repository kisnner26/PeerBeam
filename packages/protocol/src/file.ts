import { z } from 'zod';

export const CHUNK_SIZE = 64 * 1024;
export const MAX_FILE_SIZE = 128 * 1024 * 1024;
export const MAX_CONTROL_BYTES = 8192;
const id = z.uuid();
export const fileMetadataSchema = z
  .strictObject({
    id,
    name: z.string().min(1).max(255),
    size: z.number().int().min(0).max(MAX_FILE_SIZE),
    mimeType: z.string().max(255),
    chunkSize: z.number().int().min(1024).max(CHUNK_SIZE),
    totalChunks: z
      .number()
      .int()
      .min(0)
      .max(MAX_FILE_SIZE / 1024),
  })
  .refine(
    (file) => file.totalChunks === Math.ceil(file.size / file.chunkSize),
    'Inconsistent chunk count',
  );
export const fileMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('file-offer'),
    transferId: id,
    file: fileMetadataSchema,
  }),
  z.strictObject({ type: z.literal('file-accept'), transferId: id }),
  z.strictObject({ type: z.literal('file-reject'), transferId: id }),
  z.strictObject({ type: z.literal('transfer-start'), transferId: id }),
  z.strictObject({
    type: z.literal('chunk-meta'),
    transferId: id,
    index: z.number().int().min(0),
    size: z.number().int().min(1).max(CHUNK_SIZE),
  }),
  z.strictObject({
    type: z.literal('transfer-complete'),
    transferId: id,
    phase: z.enum(['sent', 'ack']),
  }),
  z.strictObject({ type: z.literal('transfer-cancel'), transferId: id }),
  z.strictObject({
    type: z.literal('transfer-error'),
    transferId: id,
    message: z.string().min(1).max(200),
  }),
]);
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type FileMessage = z.infer<typeof fileMessageSchema>;
