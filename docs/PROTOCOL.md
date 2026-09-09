# v0.1 protocol

The executable specification is `packages/protocol/src`. All JSON objects are strict Zod schemas; unknown fields are rejected. This protocol is experimental and has no backwards-compatibility promise yet.

## Signaling

Client messages: `create-session`, `join-session`, `offer`, `answer`, `ice-candidate`, `ping`.

Server messages: `session-created`, `session-joined`, `peer-ready`, `offer`, `answer`, `ice-candidate`, `peer-disconnected`, `session-error`, `pong`.

Messages are WebSocket text frames capped at 32 KiB (SDP at 24 KiB). Binary frames and file messages are rejected. Peers cannot specify a target session when relaying: membership determines the sole recipient. The first member is the offerer, avoiding simultaneous SDP offers. The client serializes async signaling work and queues ICE received before the remote description.

Codes use eight characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, generated with Node crypto `randomInt`; IDs use `randomUUID`. Collisions are retried up to 100 times. Creating or joining while already a member is rejected. Membership and codes exist only in RAM. Empty sessions are deleted immediately, single-peer sessions after 10 minutes of inactivity (swept every 30 seconds). Two responsive peers are exempt from waiting inactivity expiry, but every session expires 60 minutes after creation. Ping/pong does not renew either deadline. `WAITING_TTL_MS` and `ABSOLUTE_TTL_MS` configure these values. Expiry removes memberships, sends `session-expired` and closes sockets (forced after 5 seconds). Unjoined sockets expire by the waiting TTL; all sockets have an absolute lifetime measured from connection.

Five failed joins per connection per 60-second window exhaust the join budget; subsequent joins return `rate-limited`. Invalid join schemas count. Other operations retain their general message budget. Admission permits at most 500 sessions and 1,000 sockets. See SECURITY.md for proxy recommendations and limitations.

Six-character clients are incompatible with the new code schema. Deploy the matching web and signaling versions together and recreate old waiting sessions. The file-channel wire format is unchanged.

## File channel

One ordered, reliable channel named `peerbeam-v1`. `binaryType` is `arraybuffer`. Control messages are strict JSON strings, at most 8 KiB; chunk payloads are separate binary messages. Both peers use the same channel for sequential transfers in either direction.

```text
Sender                         Receiver
file-offer -------------------> offered (no bytes accepted)
           <------------------- file-accept | file-reject
transfer-start ---------------> accepted → transferring
chunk-meta {index,size} -------> validate expected sequence and size
ArrayBuffer ------------------> accumulate exact byte count
... repeat ...
transfer-complete {phase:sent}-> verify total bytes and chunks, create Blob
           <------------------- transfer-complete {phase:ack}
complete                        complete + download link
```

`file-offer` includes `transferId` and `file: {id,name,size,mimeType,totalChunks,chunkSize}`. UUIDs distinguish transfers. File sizes are integers from 0 to 128 MiB. Chunk size is up to `CHUNK_SIZE` (64 KiB), reduced to the negotiated SCTP message limit if necessary, with a 1 KiB minimum. `totalChunks` must equal `ceil(size/chunkSize)`. Zero-byte files send no binary messages but still require acceptance and acknowledgement.

Each binary message must immediately follow its metadata and have the declared length. The receiver checks index, expected final-chunk size, transfer identity, accepted state, total byte count and final chunk count. Completion means all expected bytes were reconstructed, not a SHA-256 integrity guarantee.

The sender checks `bufferedAmount` before each chunk. Above 1 MiB it waits for `bufferedamountlow` at 256 KiB. The queue may exceed the high watermark by one chunk plus its control message. Waits stop on cancellation, channel close, error or a 30-second stall. Chunks are read with `File.slice().arrayBuffer()`, not by loading the entire file.

Both peers can send `transfer-cancel` or `transfer-error`. Terminal decisions never change after notification failure. The last 16 terminal IDs are retained: queued data for cancelled/rejected/error transfers can be discarded only as adjacent metadata/binary pairs of matching size. Control messages cannot interrupt such pairs. Duplicate completion or chunk metadata after success is a protocol violation; late cancellation/error cannot undo success. Simultaneous file offers are rejected as busy. Only one active file exists per connection. Offer consent times out after 120 seconds; active transfer inactivity after 30 seconds. Timer generations prevent old callbacks from failing new transfers. Failed acknowledgement sends revoke any newly created download URL. Protocol violations close the data channel.

Signaling loss before DataChannel open fails setup. After open, it leaves the established PeerConnection, DataChannel and active transfer running with a warning. Reloading, leaving or actual data-plane failure ends the session; signaling reconnect and transfer resume are deliberately absent.

## Diagnostics

ICE, PeerConnection and channel states come from the live objects. Once per second, `getStats()` supplies the selected candidate pair through the transport's `selectedCandidatePairId`, candidate types, and matching data-channel byte counters where available. A selected `relay` candidate means relay; both known non-relay candidate types mean direct. Without sufficient evidence the type is `unknown` and missing metrics read `Unavailable`.

Data-channel byte counters include control payloads and differ from file progress. File progress counts queued bytes on send and validated bytes on receive. Average speed is file bytes divided by elapsed transfer time, not an instantaneous network bandwidth measurement. The sender remains awaiting acknowledgement after reaching 100% until the receiver confirms completion.

Reference: [MDN DataChannels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels) and [bufferedAmountLowThreshold](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold).
