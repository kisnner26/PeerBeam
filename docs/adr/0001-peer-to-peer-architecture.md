# ADR 0001: Two-peer WebRTC architecture

Status: Accepted for v0.1

## Context

PeerBeam should be easy to use and technically inspectable. File storage and hosting costs should not grow with transferred payload size. The first release must remain small enough for contributors to understand and test.

## Decision

Use React/Vite for the UI, an explicit WebRTC connection manager, an independent transfer state machine, and a minimal Node WebSocket server. Share strict Zod protocols in a TypeScript npm-workspaces monorepo. Support one active file between two peers, with explicit consent and bounded sending buffers. No account system, database, or relay fallback.

## Why WebRTC

Browsers already implement ICE negotiation, reliable ordered DataChannels and DTLS encryption. This avoids a native client and custom transport cryptography. WebRTC also exposes connection states and statistics for inspection. NAT traversal remains network-dependent; STUN is optional and TURN is deferred.

## Why WebSocket signaling

SDP and ICE require bidirectional exchange before the data channel exists. WebSocket is small, familiar and sufficient for temporary two-peer rooms. It is separated from file transport and accepts no file messages or binary frames.

## Why no database

Codes and membership are ephemeral. Losing them on restart is acceptable and understandable. In-memory maps avoid persistence, migrations and infrastructure for information that should expire.

## Why two peers initially

One creator and one joining peer avoid mesh topology, multi-recipient consent, fan-out scheduling and SDP glare. The transfer state machine can be tested independently of WebRTC. A single active file limits concurrency and memory complexity.

## Why a TypeScript monorepo

One language and lockfile simplify setup. Inferred types stay aligned with runtime schemas. Shared packages contain only actual cross-boundary code; React hooks are adapters, not transport implementations. React state needs no additional store.

## Consequences

Files bypass signaling, but peers and the signaling operator still learn network information. Signaling and app hosting remain trust boundaries; session codes are bearer invitations, not identity verification. Deployments need HTTPS/WSS. Some networks will fail without TURN. The receiver uses RAM, so v0.1 caps files at 128 MiB and discards downloads on session teardown or replacement. Completion verifies sizes and ordering, not content hashes. A server restart drops signaling membership but preserves already open P2P channels; scaling across multiple server instances is unsupported.

## Alternatives considered

- Server uploads: simpler reachability, but route/store payloads on infrastructure and change the privacy model.
- Native applications: permit broader filesystem APIs but require installation and a different stack.
- Manual copy/paste SDP: eliminates signaling hosting but damages the eight-character-code experience.
- Socket frameworks or a database-backed server: unnecessary protocol and operational weight for two temporary peers.
- Custom encryption: adds key-management and verification risks; use browser DTLS and describe its guarantees accurately.
