# Security policy

## Supported versions

Only the current v0.1 line is supported. This is an early release, not a security-audited product.

## Reporting a vulnerability

Do not post exploit details or private files in public issues. When the repository is published, use GitHub's **Security → Report a vulnerability** if private reporting is enabled. Otherwise contact a maintainer through a private method on their profile; if none exists, open an issue requesting a private security contact without vulnerability details. Maintainers must enable private vulnerability reporting before inviting public security reports.

Include affected version, browser and OS, impact, minimal reproduction with synthetic data, and any proposed mitigation. There is no promised response SLA at this stage. Coordinate disclosure after maintainers can assess and fix the issue.

## Trust and data boundaries

- DataChannels use browser-provided DTLS encryption. PeerBeam adds no custom end-to-end encryption or verified identity layer and promises no anonymity.
- A six-character code is a temporary bearer invitation. Anyone who knows or guesses it can join first. Check the recipient through a trusted channel and accept only expected offers.
- The signaling server sees connection IPs, codes, membership, SDP and ICE. It does not receive file offers, metadata or payloads through the application protocol and stores no files. A hostile client can put arbitrary text into an allowed SDP field: protocol validation is not a proof that all submitted text is genuine SDP. The server never interprets that text as file content.
- The web origin and signaling operator must be trusted. Use HTTPS/WSS outside localhost; untrusted signaling can redirect negotiation.
- Optional STUN learns network addresses. TURN is not implemented. There is no fallback upload.
- Names are normalized for download and escaped by React; received content is only a download attachment, never an HTML preview. The app does not scan files for malware.
- Files are assembled in browser memory up to 128 MiB. Starting another transfer, leaving or reloading releases the previous download. There is no disk persistence, hash verification or resume support.

## Abuse controls and limits

Strict Zod objects, payload limits, bounded sessions/sockets, per-socket message limits, outbound signaling buffer limits, heartbeat cleanup, session expiration, transfer timeouts, sequence checks and backpressure reduce accidental and simple malicious resource abuse. They do not prevent distributed guessing or denial of service. Origin checks protect browser use but do not authenticate non-browser clients. Hardened public hosting and multi-instance operation are future work.
