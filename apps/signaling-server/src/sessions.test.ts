import { describe, expect, it } from 'vitest';
import { codeSchema } from '@peerbeam/protocol';
import { generateCode, SessionManager } from './sessions';

describe('session manager', () => {
  it('bounds absolute lifetime, releases memberships and permits code reuse', () => {
    let now = 0;
    const manager = new SessionManager<string>(
      100,
      () => now,
      () => 'ABCDEFGH',
      1000,
    );
    const room = manager.create('a');
    if (!room.ok) throw new Error('Missing room');
    manager.join(room.session.code, 'b');
    now = 100;
    expect(manager.expire()).toEqual([]);
    manager.touch(room.session);
    now = 1000;
    expect(manager.expire()).toEqual(['a', 'b']);
    expect(manager.forPeer('a')).toBeUndefined();
    expect(manager.forPeer('b')).toBeUndefined();
    expect(manager.leave('a')).toEqual([]);
    expect(manager.create('c').ok).toBe(true);
  });
  it('does not renew absolute lifetime on leave and rejoin', () => {
    let now = 0;
    const manager = new SessionManager<string>(100, () => now, undefined, 200);
    const room = manager.create('a');
    if (!room.ok) throw new Error('Missing room');
    manager.join(room.session.code, 'b');
    now = 150;
    expect(manager.leave('a')).toEqual(['b']);
    manager.join(room.session.code, 'c');
    now = 200;
    expect(manager.expire()).toEqual(['b', 'c']);
  });
  it('accepts exactly 500 sessions and recovers capacity when the last peer leaves', () => {
    const manager = new SessionManager<number>();
    for (let i = 0; i < 500; i++) expect(manager.create(i).ok).toBe(true);
    expect(manager.create(500)).toEqual({ ok: false, reason: 'server-full' });
    manager.leave(0);
    expect(manager.create(500).ok).toBe(true);
  });
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
    expect(manager.join('ZZZZZZZZ', 'd')).toEqual({
      ok: false,
      reason: 'session-not-found',
    });
  });
  it('retries collisions and bounds exhausted code generation', () => {
    const codes = ['AAAAAAAA', 'AAAAAAAA', 'BBBBBBBB'];
    const manager = new SessionManager<string>(
      100,
      Date.now,
      () => codes.shift() ?? 'BBBBBBBB',
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
