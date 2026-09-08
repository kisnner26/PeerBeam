# Changelog

## 0.1.0 — 2026-09-08

### Added

- TypeScript npm-workspaces monorepo with React, Vite, Tailwind CSS and a Node WebSocket server.
- Temporary two-peer codes, validated signaling and lifecycle cleanup.
- WebRTC DataChannel transfer with explicit consent, chunking, backpressure, cancellation, progress and receiver confirmation.
- Download-only reception up to 128 MiB, basic diagnostics and responsive dark interface.
- Vitest and React Testing Library coverage, CI, MIT license and contributor documentation.

### Limitations

- One file in memory, no background persistence, resume, content hash, folders, TURN or multi-peer sessions.
- Cross-device connectivity depends on browser support, secure hosting and network NAT/firewall rules.
