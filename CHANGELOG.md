# Changelog

## Unreleased

- Optional `docker compose up` development workflow alongside the native `npm run dev`; see docs/DOCKER.md.
- Professional OSS onboarding, contribution templates, and a public issue roadmap.

- Established P2P sessions survive signaling loss with a nonfatal warning.
- Eight-character session codes and a five-failed-join/60-second connection budget; six-character clients require a coordinated update.
- Configurable waiting/absolute lifetimes, bounded idle sockets and capacity checks before WebSocket admission.
- Transfer race fixes for failed sends, terminal decisions, stale framing, timers, listeners and download cleanup.
- Two real Chromium E2E scenarios covering exact file bytes and signaling shutdown during transfer.

- English/Spanish interface, including consent, progress, errors and diagnostic labels.
- Day/night themes with persistent preferences and accessible header controls.

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
