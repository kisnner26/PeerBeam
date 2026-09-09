# Validation guide

## Automated checks

From a fresh checkout on Node 22.14+:

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Vitest runs server/protocol/transfer tests in Node and component tests in jsdom. In-memory channel doubles exercise the real transfer manager, including exact Blob bytes and terminal states. The WebSocket integration test starts a real server on an ephemeral port. These tests do not simulate actual ICE or browser NAT behavior.

## Real browser E2E

Playwright starts a dedicated Vite instance on 127.0.0.1:5188 and each test starts a real signaling server on 127.0.0.1:8099. Those ports must be free. Chromium uses two isolated browser contexts, real PeerConnections and DataChannels, without STUN. CI installs Chromium with `npx playwright install --with-deps chromium` and runs the same two tests with one worker and no retries.

Both scenarios create/join, inspect a synthetic 2 MiB offer, assert no binary sends before acceptance, accept, reach confirmed completion on both ends, and compare downloaded bytes exactly. The resilience case gates the fifth Blob read after four real chunks, stops the signaling server and its sockets, checks both warnings, then releases the read and verifies completion. Only file-read pacing and send observation are instrumented; WebRTC transport is real. There are no arbitrary sleeps or mocked signaling disconnects.

Traces on failure and downloads are under ignored `output/e2e`. This covers Chromium on one host, not physical devices, Firefox, NAT traversal or TURN. The environment must permit browser child processes and local WebRTC UDP traffic.

## Browser smoke check

1. Run `npm run dev`; open localhost:5173 in two separate browser contexts.
2. Create and join a session. Both must say “Peer connected”.
3. Select a synthetic multi-chunk file. Before acceptance, verify zero payload progress.
4. Reject it. Send again and accept; wait for receiver-confirmed completion.
5. Download and compare its bytes/hash with the original using a local tool. This is validation of the implementation, not an in-app hash feature.
6. Repeat in the opposite direction and with an empty file.
7. Cancel an offered/in-progress file. Leave a session; the other peer should report interruption.
8. Try invalid, unknown and full codes. Restart after a failure.
9. Expand Connection details. Check real state names, selected candidate types and counters. Missing values must be unavailable.
10. Inspect desktop and 390px mobile layouts, keyboard focus, console errors and horizontal overflow.

Keep synthetic fixtures, browser downloads and screenshots in ignored `output/playwright/`. Do not commit private files or live network metadata. Repeat on two physical devices using trusted HTTPS/WSS before claiming cross-device/network coverage. Automated localhost E2E does not replace this network coverage.
