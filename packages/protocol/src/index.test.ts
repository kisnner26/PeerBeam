import { expect, it } from 'vitest';
import { clientMessageSchema, serverMessageSchema } from './index';

it('validates discriminated signaling messages and rejects unknown properties', () => {
  expect(
    clientMessageSchema.safeParse({ type: 'join-session', code: 'B7K4Q2M9' })
      .success,
  ).toBe(true);
  for (const message of [
    { type: 'join-session', code: 'bad' },
    { type: 'create-session', file: 'secret' },
    { type: 'file-offer' },
    { type: 'offer', sdp: { type: 'answer', sdp: 'v=0' } },
  ]) {
    expect(clientMessageSchema.safeParse(message).success).toBe(false);
  }
  expect(
    serverMessageSchema.safeParse({ type: 'peer-ready', initiator: true })
      .success,
  ).toBe(true);
  expect(
    serverMessageSchema.safeParse({
      type: 'offer',
      sdp: { type: 'offer', sdp: 'x'.repeat(32768) },
    }).success,
  ).toBe(false);
});
