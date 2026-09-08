import { describe, expect, it } from 'vitest';
import { codeSchema } from '@peerbeam/protocol';
import { generateCode, SessionManager } from './sessions';

describe('session manager', () => {
  it('generates valid random codes', () => {
    const codes = Array.from({ length: 500 }, generateCode);
    expect(codes.every((code) => codeSchema.safeParse(code).success)).toBe(
      true,
    );
    expect(new Set(codes).size).toBe(500);
  });
  it('creates, joins, rejects a third peer and duplicate membership', () => {
    const manager = new SessionManager<string>();
    const created = manager.create('a');
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('Creation failed');
    expect(manager.join(created.session.code, 'b').ok).toBe(true);
    expect(manager.join(created.session.code, 'c')).toEqual({
      ok: false,
      reason: 'session-full',
    });
    expect(manager.create('a')).toEqual({
      ok: false,
      reason: 'already-in-session',
    });
    expect(manager.join('ZZZZZZ', 'd')).toEqual({
      ok: false,
      reason: 'session-not-found',
    });
  });
  it('retries collisions and bounds exhausted code generation', () => {
    const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    const manager = new SessionManager<string>(
      100,
      Date.now,
      () => codes.shift() ?? 'BBBBBB',
    );
    expect(manager.create('a').ok).toBe(true);
    expect(manager.create('b').ok).toBe(true);
    expect(manager.create('c')).toEqual({ ok: false, reason: 'server-full' });
  });
  it('expires waiting sessions, rejects stale joins and releases membership', () => {
    let now = 0;
    const manager = new SessionManager<string>(100, () => now);
    const created = manager.create('a');
    if (!created.ok) throw new Error('Creation failed');
    now = 100;
    expect(manager.join(created.session.code, 'b')).toEqual({
      ok: false,
      reason: 'session-expired',
    });
    expect(manager.expire()).toEqual(['a']);
    expect(manager.forPeer('a')).toBeUndefined();
    expect(manager.create('a').ok).toBe(true);
  });
  it('keeps connected pairs, notifies survivors, and removes empty sessions', () => {
    let now = 0;
    const manager = new SessionManager<string>(100, () => now);
    const created = manager.create('a');
    if (!created.ok) throw new Error('Creation failed');
    manager.join(created.session.code, 'b');
    now = 1000;
    expect(manager.expire()).toEqual([]);
    expect(manager.leave('a')).toEqual(['b']);
    expect(manager.expire()).toEqual([]);
    manager.leave('b');
    expect(manager.join(created.session.code, 'c')).toEqual({
      ok: false,
      reason: 'session-not-found',
    });
  });
});
