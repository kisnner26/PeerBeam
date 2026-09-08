import { z } from 'zod';
export * from './file';

export const MAX_SIGNAL_BYTES = 32 * 1024;
export const codeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const sdp = z
  .string()
  .min(1)
  .max(24 * 1024);
export const relaySchemas = [
  z.strictObject({
    type: z.literal('offer'),
    sdp: z.strictObject({ type: z.literal('offer'), sdp }),
  }),
  z.strictObject({
    type: z.literal('answer'),
    sdp: z.strictObject({ type: z.literal('answer'), sdp }),
  }),
  z.strictObject({
    type: z.literal('ice-candidate'),
    candidate: z.strictObject({
      candidate: z.string().max(4096),
      sdpMid: z.string().max(256).nullable().optional(),
      sdpMLineIndex: z.number().int().min(0).max(65535).nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    }),
  }),
] as const;
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create-session') }),
  z.strictObject({ type: z.literal('join-session'), code: codeSchema }),
  ...relaySchemas,
  z.strictObject({ type: z.literal('ping') }),
]);
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('session-created'),
    sessionId: z.uuid(),
    code: codeSchema,
  }),
  z.strictObject({
    type: z.literal('session-joined'),
    sessionId: z.uuid(),
    code: codeSchema,
  }),
  z.strictObject({ type: z.literal('peer-ready'), initiator: z.boolean() }),
  ...relaySchemas,
  z.strictObject({ type: z.literal('peer-disconnected') }),
  z.strictObject({
    type: z.literal('session-error'),
    reason: z.enum([
      'invalid-message',
      'session-not-found',
      'session-full',
      'already-in-session',
      'not-in-session',
      'peer-unavailable',
      'session-expired',
      'rate-limited',
      'server-full',
    ]),
  }),
  z.strictObject({ type: z.literal('pong') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type RelayMessage = Extract<
  ClientMessage,
  { type: 'offer' | 'answer' | 'ice-candidate' }
>;
export type SessionError = Extract<
  ServerMessage,
  { type: 'session-error' }
>['reason'];
