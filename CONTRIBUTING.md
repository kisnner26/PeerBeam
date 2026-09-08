# Contributing to PeerBeam

Small, reviewable contributions are welcome. Read the [README](README.md), [ADR](docs/adr/0001-peer-to-peer-architecture.md) and [Code of Conduct](CODE_OF_CONDUCT.md). Pick a proposal from [INITIAL_ISSUES](docs/INITIAL_ISSUES.md), or discuss a larger change in an issue first.

1. Fork the published PeerBeam repository on GitHub.
2. Clone your fork using its actual URL, then `cd peerbeam`.
3. Create a branch: `git switch -c feat/your-change`.
4. Run `npm ci` (Node 22.14+), then `npm run dev`.
5. Make one focused change and add behavior-focused tests where appropriate.
6. Run the checks below and inspect `git diff`.
7. Commit with Conventional Commits, push your branch to your fork, and open a pull request against `main`.

```sh
npm run format
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`.

Commit example: `feat(web): add file offer dialog`. Use `fix`, `docs`, `test`, `refactor`, `chore` or `build` as appropriate. Explain the user-visible behavior and validation in the PR. Include screenshots for interface changes and network/browser details for WebRTC reports. Keep generated output, `.env`, secrets and local captures out of commits; commit lockfile changes when dependencies change.

All implementation code is TypeScript with strict checking. Keep WebRTC and transfer code out of React components, validate boundary messages with Zod, and avoid new dependencies without a clear need. Changes to the file protocol should include malformed-data and state-transition tests. See [TESTING](docs/TESTING.md) for manual browser checks. No complex WebRTC E2E suite is required for this release.

Contributions are made under the project's MIT license. Never include another person's private files or session data in reports. Security issues follow [SECURITY.md](SECURITY.md), not public bug reports.
