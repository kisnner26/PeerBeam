import { randomInt, randomUUID } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '@peerbeam/shared';
import type { SessionError } from '@peerbeam/protocol';
export const WAITING_TTL_MS = 10 * 60_000;
export const ABSOLUTE_TTL_MS = 60 * 60_000;
export const MAX_SESSIONS = 500;

export function generateCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');
}
export interface Session<Peer> {
  id: string;
  code: string;
  peers: Peer[];
  lastActivity: number;
  createdAt: number;
}
type Result<Peer> =
  { ok: true; session: Session<Peer> } | { ok: false; reason: SessionError };

/** Two connected peers keep a session alive; signaling cannot observe file activity. */
export class SessionManager<Peer> {
  private readonly sessions = new Map<string, Session<Peer>>();
  private readonly memberships = new Map<Peer, Session<Peer>>();
  constructor(
    private readonly ttlMs = WAITING_TTL_MS,
    private readonly now = Date.now,
    private readonly codeFactory = generateCode,
    private readonly absoluteTtlMs = ABSOLUTE_TTL_MS,
    private readonly maxSessions = MAX_SESSIONS,
  ) {}
  create(peer: Peer): Result<Peer> {
    if (this.memberships.has(peer))
      return { ok: false, reason: 'already-in-session' };
    if (this.sessions.size >= this.maxSessions)
      return { ok: false, reason: 'server-full' };
    let code = '';
    for (let attempts = 0; attempts < 100; attempts++) {
      const candidate = this.codeFactory();
      if (!this.sessions.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) return { ok: false, reason: 'server-full' };
    const session = {
      id: randomUUID(),
      code,
      peers: [peer],
      lastActivity: this.now(),
      createdAt: this.now(),
    };
    this.sessions.set(code, session);
    this.memberships.set(peer, session);
    return { ok: true, session };
  }
  join(code: string, peer: Peer): Result<Peer> {
    if (this.memberships.has(peer))
      return { ok: false, reason: 'already-in-session' };
    const session = this.sessions.get(code);
    if (!session) return { ok: false, reason: 'session-not-found' };
    if (this.isExpired(session))
      return { ok: false, reason: 'session-expired' };
    if (session.peers.length === 2)
      return { ok: false, reason: 'session-full' };
    if (this.now() - session.lastActivity >= this.ttlMs)
      return { ok: false, reason: 'session-expired' };
    session.peers.push(peer);
    this.memberships.set(peer, session);
    this.touch(session);
    return { ok: true, session };
  }
  forPeer(peer: Peer) {
    return this.memberships.get(peer);
  }
  touch(session: Session<Peer>) {
    session.lastActivity = this.now();
  }
  leave(peer: Peer): Peer[] {
    const session = this.memberships.get(peer);
    if (!session) return [];
    this.memberships.delete(peer);
    session.peers = session.peers.filter((entry) => entry !== peer);
    this.touch(session);
    if (!session.peers.length) this.sessions.delete(session.code);
    return session.peers;
  }
  expire(): Peer[] {
    const expired: Peer[] = [];
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) continue;
      for (const peer of session.peers) {
        this.memberships.delete(peer);
        expired.push(peer);
      }
      this.sessions.delete(session.code);
    }
    return expired;
  }
  private isExpired(session: Session<Peer>) {
    return (
      this.now() - session.createdAt >= this.absoluteTtlMs ||
      (session.peers.length < 2 &&
        this.now() - session.lastActivity >= this.ttlMs)
    );
  }
}
