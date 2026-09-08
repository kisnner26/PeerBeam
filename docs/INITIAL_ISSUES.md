# Initial issue proposals

These are future contribution opportunities, not implemented features or issues already posted to GitHub. Labels can overlap. Keep each PR focused and discuss protocol changes first.

## good first issue

1. **Add file-size formatter boundary tests.** Cover B/KiB/MiB transitions and rounding without changing units.
2. **Improve invalid-code input feedback.** Explain forbidden characters beside the field before submission; preserve accessible labels.
3. **Add file type icon mapping.** Use a small local map and a generic fallback; no content previews or remote assets.
4. **Improve the README connection diagram.** Provide an accessible SVG showing signaling and payload paths distinctly.
5. **Add clipboard feedback reset.** Return “Copied” to its original label after a brief interval, with timer cleanup and a test.

## help wanted

6. **Audit the incoming-file interaction with screen readers.** Test focus restoration and announcements in NVDA and VoiceOver; document findings before changing behavior.
7. **Build a browser/network compatibility matrix.** Record Chrome, Edge, Firefox and Safari across LAN and separate networks, including expected no-TURN failures.
8. **Design translation architecture.** Propose English/Portuguese string extraction and fallback behavior without adding a large runtime dependency.

## feature

9. **QR session invitations (v0.2).** Encode the app origin and code, with a visible text alternative and explicit join action.
10. **Multiple-file queue (v0.2).** Specify consent per file, queue cancellation and memory limits before implementation.
11. **Drag-and-drop improvements (v0.2).** Handle nested drag targets without flicker and explain unsupported directory drops.
12. **SHA-256 verification (v0.3).** Define digest framing, asynchronous computation, mismatch UX and large-file memory costs.
13. **Resumable transfers (v0.3).** Design identity, chunk tracking and reconnect trust boundaries; do not assume files persist.
14. **Streaming-to-disk adapter (v0.4).** Explore File System Access support with a documented fallback.
15. **Configurable TURN (v0.5).** Define secure credential provisioning and relay diagnostics before adding configuration.

## testing

16. **Signaling abuse regression tests.** Cover max payload, rate windows, origin policy and stale socket heartbeat behavior.
17. **Simultaneous offers and repeated-session stress tests.** Exercise cancellation races and confirm listener/Blob cleanup over many transfers.
18. **Reduced-motion and narrow-viewport accessibility checks.** Cover keyboard-only use, 200% zoom, touch targets and contrast.

## documentation

19. **Troubleshooting guide with real network examples.** Explain secure origins, WSS, firewall rules and unavailable ICE metrics without promising universal NAT traversal.
20. **Contributor walkthrough of the state machine.** Trace one accepted and one interrupted file through tests and source references.

For v0.2, prioritize issues 6, 9, 10, 11 and 18. Do not bundle later roadmap phases into the first release.
