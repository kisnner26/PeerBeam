# Contributing to PeerBeam

Thank you for helping improve PeerBeam. Keep contributions focused, reviewable, and consistent with the v0.1 privacy and protocol boundaries.

## Prerequisites

- Node.js 22.14 or newer and npm.
- A current Chromium-based browser for the automated E2E suite.
- Git. A GitHub account is needed to open a pull request.

## Setup

Fork the repository, then clone your fork using its actual URL:

```sh
git clone https://github.com/YOUR-USERNAME/PeerBeam.git
cd PeerBeam
npm ci
npm run dev
```

The combined development command starts the app at <http://localhost:5173> and signaling at `ws://127.0.0.1:8080`. Local defaults require no environment file. Copy `.env.example` to `.env` only when changing configuration; never commit `.env`, secrets, live session data, or personal test files.

## Monorepo architecture

- `apps/web`: React/Vite UI. Connection code lives under `connection`; the transfer state machine lives under `transfer`.
- `apps/signaling-server`: in-memory two-peer sessions and WebSocket relay for validated SDP/ICE.
- `packages/protocol`: strict Zod schemas and types for signaling and file-channel control messages.
- `packages/shared`: session-code constants and normalization shared by app and server.
- `e2e`: Playwright tests using two real browser contexts and a real WebRTC DataChannel.
- `docs`: protocol, testing, security hardening, delivery history, and architecture decisions.

The signaling server must never accept, store, or relay file metadata or file payload. File transfer belongs exclusively on the WebRTC DataChannel. Keep boundary schemas strict; do not replace strict validation with permissive parsing.

## Useful commands

```sh
npm run dev
npm run format
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Run unit/integration tests for ordinary changes. Run Playwright when changing connection, transfer, consent, download, or visible end-to-end behavior. The E2E suite needs ports 5188 and 8099 available and an environment that permits browser processes and local WebRTC traffic. See [docs/TESTING.md](docs/TESTING.md) for scope and manual cross-device checks.

Before opening a pull request, run all checks unless a check clearly does not apply; explain any omitted or failed check in the PR.

## Branches and commits

Create a branch from current `main`. Use a short prefix that matches the work: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, or `chore/`.

Use Conventional Commits and keep each commit logically focused. Examples:

```text
fix(transfer): reject stale chunk metadata
docs: clarify local signaling setup
test(e2e): cover Firefox file transfer
```

## Pull requests

Open the PR against `main` and complete the repository template. Explain the concrete problem, resulting behavior, related issue, and validation. Include screenshots for visible UI changes only. For WebRTC/network changes, include browsers, topology, and known limits. Document any protocol or security impact in the protocol, security policy, tests, and changelog as appropriate.

Avoid bundling roadmap features or unrelated cleanup. New dependencies need a clear reason. All implementation remains TypeScript with strict checking, and malformed protocol/state-transition behavior needs tests.

## Security considerations

- Use synthetic fixtures; never include private files, active codes, SDP, ICE addresses, credentials, or personal network data.
- Do not describe Origin checks as authentication.
- Do not claim anonymity, verified identity, custom end-to-end encryption, universal connectivity, or content integrity.
- Preserve explicit receiver consent, download-only received content, filename sanitization, payload limits, and signaling/file-plane separation.
- Report vulnerabilities using [SECURITY.md](SECURITY.md), not a public issue.

## Good first contributions

Good starting points include documentation corrections, small UI/accessibility improvements, focused test coverage, and isolated bugs with a clear reproduction. Look for the [`good first issue`](https://github.com/hoowertsg19/PeerBeam/labels/good%20first%20issue) label.

Cryptography design, TURN credential handling, WebRTC negotiation changes, resumability, and deep wire-protocol changes require broader security and architecture review and are not good first contributions.

Contributions are made under the project's [MIT license](LICENSE) and must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
