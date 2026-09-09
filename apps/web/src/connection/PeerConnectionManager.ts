import type { RelayMessage } from '@peerbeam/protocol';

export interface ConnectionDetails {
  ice: string;
  peer: string;
  channel: string;
  localCandidate: string;
  remoteCandidate: string;
  connectionType: 'direct' | 'relay' | 'unknown';
  bytesSent: number | null;
  bytesReceived: number | null;
}
export const emptyDetails: ConnectionDetails = {
  ice: 'new',
  peer: 'new',
  channel: 'Unavailable',
  localCandidate: 'Unavailable',
  remoteCandidate: 'Unavailable',
  connectionType: 'unknown',
  bytesSent: null,
  bytesReceived: null,
};

export class PeerConnectionManager {
  readonly pc: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private pendingIce: RTCIceCandidateInit[] = [];
  private disposed = false;
  private timeout?: ReturnType<typeof setTimeout>;
  private disconnectTimeout?: ReturnType<typeof setTimeout>;
  constructor(
    private readonly sendSignal: (message: RelayMessage) => void,
    private readonly onChannel: (channel: RTCDataChannel) => void,
    private readonly onError: (message: string) => void,
  ) {
    const stun = import.meta.env.VITE_STUN_URL?.trim();
    this.pc = new RTCPeerConnection({
      iceServers: stun ? [{ urls: stun }] : [],
    });
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        try {
          this.sendSignal({
            type: 'ice-candidate',
            candidate: {
              ...candidate.toJSON(),
              candidate: candidate.candidate,
            },
          });
        } catch {
          this.fail('Signaling disconnected during connection setup.');
        }
      }
    };
    this.pc.ondatachannel = ({ channel }) => this.handleDataChannel(channel);
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'connected') {
        clearTimeout(this.timeout);
        clearTimeout(this.disconnectTimeout);
      }
      if (this.pc.connectionState === 'failed')
        this.fail(
          'WebRTC failed. This network may require TURN, which v0.1 does not provide.',
        );
      if (this.pc.connectionState === 'disconnected') {
        clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = setTimeout(
          () => this.fail('Peer connection interrupted. Start a new session.'),
          10_000,
        );
      }
    };
    this.timeout = setTimeout(
      () =>
        this.fail(
          'Connection failed: WebRTC timed out. Try devices on the same network.',
        ),
      30_000,
    );
  }
  private fail(message: string) {
    if (!this.disposed) this.onError(message);
  }
  private handleDataChannel(channel: RTCDataChannel) {
    if (
      this.channel ||
      channel.label !== 'peerbeam-v1' ||
      !channel.ordered ||
      channel.maxRetransmits !== null ||
      channel.maxPacketLifeTime !== null
    ) {
      channel.close();
      return;
    }
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onerror = () =>
      this.fail('Data channel failed. Transfer interrupted.');
    channel.onclose = () =>
      this.fail('Data channel closed. Transfer interrupted.');
    if (channel.readyState === 'open') this.onChannel(channel);
    else channel.onopen = () => this.onChannel(channel);
  }
  async createOffer() {
    this.handleDataChannel(
      this.pc.createDataChannel('peerbeam-v1', { ordered: true }),
    );
    await this.pc.setLocalDescription(await this.pc.createOffer());
    const sdp = this.pc.localDescription?.sdp;
    if (sdp) this.sendSignal({ type: 'offer', sdp: { type: 'offer', sdp } });
  }
  async handleSignal(message: RelayMessage) {
    if (this.disposed) return;
    if (message.type === 'ice-candidate') {
      if (!this.pc.remoteDescription) {
        if (this.pendingIce.length >= 256)
          throw new Error('Too many ICE candidates.');
        this.pendingIce.push(message.candidate);
      } else await this.pc.addIceCandidate(message.candidate);
      return;
    }
    await this.pc.setRemoteDescription(message.sdp);
    for (const candidate of this.pendingIce.splice(0))
      await this.pc.addIceCandidate(candidate);
    if (message.type === 'offer') {
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      const sdp = this.pc.localDescription?.sdp;
      if (sdp)
        this.sendSignal({ type: 'answer', sdp: { type: 'answer', sdp } });
    }
  }
  get maxMessageSize() {
    return this.pc.sctp?.maxMessageSize ?? 65536;
  }
  async details(): Promise<ConnectionDetails> {
    const details: ConnectionDetails = {
      ...emptyDetails,
      ice: this.pc.iceConnectionState,
      peer: this.pc.connectionState,
      channel: this.channel?.readyState ?? 'Unavailable',
    };
    const stats = await this.pc.getStats();
    let selectedPairId: string | undefined;
    stats.forEach((stat) => {
      if (
        stat.type === 'transport' &&
        typeof stat.selectedCandidatePairId === 'string'
      )
        selectedPairId = stat.selectedCandidatePairId;
      if (stat.type === 'data-channel' && stat.label === 'peerbeam-v1') {
        details.bytesSent =
          typeof stat.bytesSent === 'number' ? stat.bytesSent : null;
        details.bytesReceived =
          typeof stat.bytesReceived === 'number' ? stat.bytesReceived : null;
      }
    });
    const pair = selectedPairId ? stats.get(selectedPairId) : undefined;
    if (pair) {
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      details.localCandidate =
        typeof local?.candidateType === 'string'
          ? local.candidateType
          : 'Unavailable';
      details.remoteCandidate =
        typeof remote?.candidateType === 'string'
          ? remote.candidateType
          : 'Unavailable';
      if ([details.localCandidate, details.remoteCandidate].includes('relay'))
        details.connectionType = 'relay';
      else if (
        [details.localCandidate, details.remoteCandidate].every((type) =>
          ['host', 'srflx', 'prflx'].includes(type),
        )
      )
        details.connectionType = 'direct';
    }
    return details;
  }
  teardown() {
    this.disposed = true;
    clearTimeout(this.timeout);
    clearTimeout(this.disconnectTimeout);
    this.pc.onicecandidate = null;
    this.pc.ondatachannel = null;
    this.pc.onconnectionstatechange = null;
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.onerror = null;
    }
    this.channel?.close();
    this.pc.close();
    this.pendingIce = [];
  }
}
