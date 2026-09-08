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
```

Vitest runs server/protocol/transfer tests in Node and component tests in jsdom. In-memory channel doubles exercise the real transfer manager, including exact Blob bytes and terminal states. The WebSocket integration test starts a real server on an ephemeral port. These tests do not simulate actual ICE or browser NAT behavior.

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

Keep synthetic fixtures, browser downloads and screenshots in ignored `output/playwright/`. Do not commit private files or live network metadata. Repeat on two physical devices using trusted HTTPS/WSS before claiming cross-device/network coverage. Stable CI intentionally does not depend on complex WebRTC E2E tests.
