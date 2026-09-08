# PeerBeam

**P2P file transfer you can actually inspect.**

> Screenshot placeholder — run the app to explore the dark, responsive transfer interface.

## What is PeerBeam?

PeerBeam is a small, open source browser application for sending one file between two devices over a WebRTC DataChannel. Create a session, share a six-character code, connect, and ask the recipient to accept the file. Expand **Connection details** to inspect the actual connection.

This v0.1 is intentionally understandable: no accounts, database, file server, or cloud dependency. It is not an anonymity tool. It uses WebRTC's DTLS transport encryption, not custom end-to-end encryption.

## Features

- Cryptographically random, temporary session codes; at most two peers.
- Explicit acceptance or rejection before reading and sending file contents.
- One active file, up to **128 MiB**, in either direction.
- Progressive reads, configurable 64 KiB chunks, negotiated message-size limits, and backpressure.
- Payload progress, average speed, chunk counts, cancellation, and receiver acknowledgement.
- Download-only received files; no embedded content previews.
- Collapsible ICE, PeerConnection, DataChannel, candidate, and byte diagnostics.
- Strict TypeScript, Zod protocols, automated tests, and CI.

## How it works

```text
Device A
   |
WebSocket (session, SDP, ICE)
   |
Signaling Server (temporary in-memory sessions)
   |
WebSocket (session, SDP, ICE)
   |
Device B

After negotiation:
Device A ========== WebRTC DataChannel / DTLS ========== Device B
                   file metadata + file chunks
```

**Files do not pass through the signaling server.** The browser's `TransferManager` sends metadata and binary chunks over an ordered, reliable DataChannel. The server only pairs peers and relays validated SDP and ICE. Optional STUN discovers network addresses; it does not relay files. v0.1 has no TURN configuration or relay fallback.

1. Create a code on device A and enter it on device B.
2. The creator offers a WebRTC connection; B answers. Both exchange ICE candidates.
3. Choose or drop a file. B sees its name and size and must accept.
4. A sends alternating `chunk-meta` JSON messages and binary chunks.
5. B validates sequence and lengths, assembles a Blob, and acknowledges completion.
6. B downloads the file. Download it before leaving, reloading, or starting another transfer: those actions release the previous Blob.

## Architecture

```text
peerbeam/
├── apps/
│   ├── web/src/
│   │   ├── components/    # Session, consent, progress, diagnostics
│   │   ├── connection/    # SignalingClient, PeerConnectionManager, React hook
│   │   └── transfer/      # State machine, chunking, backpressure, React hook
│   └── signaling-server/src/  # WebSocket transport and SessionManager
├── packages/
│   ├── protocol/src/      # Strict Zod schemas and inferred message types
│   └── shared/src/        # Code alphabet, length, normalization
├── docs/                  # Protocol, validation, initial issues, ADR
└── .github/               # CI and contribution templates
```

React state is sufficient; there is no global state library. Workspace packages export TypeScript source for Vite, Vitest, and the server bundler. The production server bundles internal workspace code and imports its declared runtime dependencies. No workspace package needs a separate build.

See [the architecture decision](docs/adr/0001-peer-to-peer-architecture.md) and [protocol specification](docs/PROTOCOL.md).

## Getting started

Requirements: **Node.js 22.14 or newer**, npm, and a modern browser with WebRTC. Use a current Node 22 LTS patch for development and CI.

After cloning this repository:

```sh
cd peerbeam
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) in two browser windows. Create a session in one and join with its code in the other. The signaling server listens on `127.0.0.1:8080`. No environment file is required for local use.

For reproducible installs after cloning, use `npm ci` instead of `npm install`. Stop both development processes with Ctrl+C.

### Environment

Copy `.env.example` to `.env` **at the repository root** when changing configuration. On PowerShell use `Copy-Item .env.example .env`; on a POSIX shell use `cp .env.example .env`.

| Variable             | Default without .env                                | Purpose                                                                                               |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PORT`               | `8080`                                              | Signaling port                                                                                        |
| `VITE_PORT`          | `5173`                                              | Vite development port; add its origin to `ALLOWED_ORIGINS` when changing it                           |
| `HOST`               | `127.0.0.1`                                         | Signaling listen interface                                                                            |
| `ALLOWED_ORIGINS`    | localhost and 127.0.0.1 on port 5173                | Comma-separated browser origins. An empty value disables this check, only for controlled development. |
| `VITE_SIGNALING_URL` | Page host on port 8080, ws/wss matching page scheme | Browser signaling address                                                                             |
| `VITE_STUN_URL`      | Empty                                               | Optional STUN URL, for example `stun:stun.l.google.com:19302`                                         |

`VITE_` values are public and embedded at build time. Restart Vite after editing them. There are no secrets to configure. A public STUN service is opt-in; its operator sees network-address requests.

### Two physical devices

Both devices need a reachable web origin and signaling address. `localhost` on a phone refers to the phone, not your computer. For secure cross-device development, serve the web app over trusted **HTTPS** and proxy signaling over **WSS**, set `VITE_SIGNALING_URL` to that reachable WSS URL, and add the exact HTTPS origin to `ALLOWED_ORIGINS`.

If developing behind a local proxy, bind Vite with `npm run dev -w @peerbeam/web -- --host 0.0.0.0` and set `HOST=0.0.0.0` as needed. Run signaling separately with `npm run dev -w @peerbeam/signaling-server`. Browser secure-context requirements mean a plain HTTP LAN address is not a supported substitute for HTTPS. Firewall rules must permit the chosen endpoints. Some NATs and enterprise networks cannot connect without TURN; v0.1 reports failure rather than uploading through a server.

## Development

```sh
npm run dev          # Web and signaling, concurrently
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run test
npm run build
```

After building, `npm start -w @peerbeam/signaling-server` runs the compiled server. `npm run preview -w @peerbeam/web -- --port 5173` previews the static app using the default allowed origin. Keep the root workspace dependencies installed for the server. Production TLS, reverse proxies and hardened public hosting are outside this release's scope.

Tests cover protocol validation, sessions and expiry, actual WebSocket relay behavior, file state transitions, chunk boundaries, exact reconstructed payloads, backpressure, interruption, and React interactions. WebRTC browser checks are separate from deterministic CI; see [validation guidance](docs/TESTING.md).

## Security

WebRTC encrypts DataChannels using DTLS. This does **not** provide anonymity or independently verified peer identity. Anyone with a live code may join first; share codes privately and accept only expected files. The signaling service and app origin must be trusted. Use HTTPS/WSS outside localhost.

The server sees IP addresses, session membership, SDP and ICE network metadata. It has no file storage, binary relay, or file-offer message type. Received names are rendered as React text and sanitized for download; received content is never executed by the app. Downloaded files can still be unsafe when opened elsewhere.

Server limits: 32 KiB per signaling message, 200 messages per socket per 10 seconds, 1,000 sockets, 500 sessions, and bounded outbound buffers. Waiting sessions expire after 10 minutes; connected pairs remain while both sockets answer heartbeat probes. These limits are not comprehensive protection against distributed abuse. See [SECURITY.md](SECURITY.md).

The receiver retains the file in RAM and creates a Blob. The 128 MiB cap is not a guarantee of memory availability on every device. No hash verification, resumability, streaming to disk, or background transfer is implemented.

## Roadmap

| Version  | Scope                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| **v0.1** | Session codes, WebRTC connection, one-file transfer, accept/reject, chunking, backpressure, progress, basic diagnostics |
| v0.2     | QR codes, drag-and-drop improvements, accessibility, multiple files                                                     |
| v0.3     | SHA-256 verification, resumable transfers                                                                               |
| v0.4     | Folders, File System Access API, streaming directly to disk where supported                                             |
| v0.5     | Docker, self-hosting, configurable TURN                                                                                 |
| v0.6     | Multi-peer transfer, advanced WebRTC diagnostics                                                                        |

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and [initial issue proposals](docs/INITIAL_ISSUES.md). The issue document contains proposals, not remotely created GitHub issues.

## License

[MIT](LICENSE) — PeerBeam contributors.
