import { useEffect, useRef, useState } from 'react';
import {
  codeSchema,
  type ServerMessage,
  type SessionError,
} from '@peerbeam/protocol';
import { normalizeCode } from '@peerbeam/shared';
import { SignalingClient } from './SignalingClient';
import { PeerConnectionManager, emptyDetails } from './PeerConnectionManager';

const errors: Record<SessionError, string> = {
  'invalid-message': 'Invalid signaling message. Please restart the session.',
  'session-not-found':
    'Session not found. Check the code or ask for a new one.',
  'session-full': 'Session full. Only two devices can connect.',
  'already-in-session': 'You are already in a session.',
  'not-in-session': 'Your session ended. Create or join a new one.',
  'peer-unavailable': 'The other device is no longer available.',
  'session-expired': 'Session expired. Create a new code.',
  'rate-limited': 'Too many requests. Wait a moment before trying again.',
  'server-full': 'The signaling server is busy. Please try again later.',
};
export function useSession() {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'waiting' | 'negotiating' | 'connected' | 'error'
  >('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [channel, setChannel] = useState<RTCDataChannel>();
  const [details, setDetails] = useState(emptyDetails);
  const signalRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<PeerConnectionManager | null>(null);
  const generation = useRef(0);
  function teardown() {
    generation.current++;
    peerRef.current?.teardown();
    signalRef.current?.close();
    peerRef.current = null;
    signalRef.current = null;
  }
  function reset() {
    teardown();
    setChannel(undefined);
    setCode('');
    setError('');
    setWarning('');
    setDetails(emptyDetails);
    setStatus('idle');
  }
  async function start(joinCode?: string) {
    const normalized =
      joinCode === undefined ? undefined : normalizeCode(joinCode);
    if (normalized !== undefined && !codeSchema.safeParse(normalized).success) {
      setError(
        'Invalid code. Enter 8 letters or numbers, excluding I, O, 0 and 1.',
      );
      return;
    }
    reset();
    const current = generation.current;
    let establishedChannel: RTCDataChannel | undefined;
    setStatus('connecting');
    const fail = (message: string) => {
      if (generation.current !== current) return;
      teardown();
      setChannel(undefined);
      setError(message);
      setDetails({
        ...emptyDetails,
        ice: 'closed',
        peer: 'closed',
        channel: 'closed',
      });
      setStatus('error');
    };
    let queue = Promise.resolve();
    const signalingFailed = (message: string) => {
      if (generation.current !== current) return;
      if (establishedChannel?.readyState !== 'open') {
        fail(message);
        return;
      }
      signalRef.current?.close();
      setWarning(
        'Signaling disconnected. Your established P2P connection continues.',
      );
    };
    const handle = async (message: ServerMessage) => {
      if (generation.current !== current) return;
      switch (message.type) {
        case 'session-created':
        case 'session-joined':
          setCode(message.code);
          setStatus('waiting');
          break;
        case 'session-error':
          signalingFailed(errors[message.reason]);
          break;
        case 'peer-disconnected':
          signalingFailed(
            'Peer disconnected. Any active transfer was interrupted. Start a new session.',
          );
          break;
        case 'peer-ready': {
          setStatus('negotiating');
          const peer = new PeerConnectionManager(
            (signal) => {
              if (generation.current === current) {
                try {
                  signalRef.current?.send(signal);
                } catch {
                  signalingFailed(
                    'Signaling disconnected during connection setup.',
                  );
                }
              }
            },
            (opened) => {
              if (generation.current === current) {
                establishedChannel = opened;
                setChannel(opened);
                setStatus('connected');
              }
            },
            fail,
          );
          peerRef.current = peer;
          if (message.initiator) await peer.createOffer();
          break;
        }
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (!peerRef.current) throw new Error('Peer setup is unavailable.');
          await peerRef.current.handleSignal(message);
          break;
        case 'pong':
          break;
      }
    };
    const signaling = new SignalingClient((message) => {
      queue = queue
        .then(() => handle(message))
        .catch((cause: unknown) =>
          fail(
            cause instanceof Error
              ? cause.message
              : 'WebRTC connection failed.',
          ),
        );
    }, signalingFailed);
    signalRef.current = signaling;
    try {
      await signaling.connect();
      if (generation.current === current)
        signaling.send(
          normalized === undefined
            ? { type: 'create-session' }
            : { type: 'join-session', code: normalized },
        );
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'Connection failed.');
    }
  }
  useEffect(() => {
    let cancelled = false;
    let polling = false;
    const timer = setInterval(() => {
      const peer = peerRef.current;
      if (!peer || polling) return;
      polling = true;
      void peer
        .details()
        .then((value) => {
          if (!cancelled && peerRef.current === peer) setDetails(value);
        })
        .catch(() => {
          if (!cancelled && peerRef.current === peer)
            setDetails({
              ...emptyDetails,
              ice: peer.pc.iceConnectionState,
              peer: peer.pc.connectionState,
            });
        })
        .finally(() => {
          polling = false;
        });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      generation.current++;
      peerRef.current?.teardown();
      signalRef.current?.close();
    };
  }, []);
  return {
    status,
    code,
    error,
    warning,
    channel,
    details,
    start,
    reset,
    maxMessageSize: peerRef.current?.maxMessageSize ?? 65536,
  };
}
