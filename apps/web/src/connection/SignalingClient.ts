import {
  clientMessageSchema,
  serverMessageSchema,
  MAX_SIGNAL_BYTES,
  type ClientMessage,
  type ServerMessage,
} from '@peerbeam/protocol';

export class SignalingClient {
  private socket?: WebSocket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private disposed = false;
  constructor(
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onError: (message: string) => void,
  ) {}
  async connect(): Promise<void> {
    const url =
      import.meta.env.VITE_SIGNALING_URL ||
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8080`;
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onmessage = (event: MessageEvent<unknown>) => {
      try {
        if (
          typeof event.data !== 'string' ||
          new TextEncoder().encode(event.data).length > MAX_SIGNAL_BYTES
        )
          throw new Error();
        this.onMessage(serverMessageSchema.parse(JSON.parse(event.data)));
      } catch {
        this.onError('The signaling server sent an invalid message.');
      }
    };
    socket.onclose = () => {
      clearInterval(this.heartbeat);
      if (!this.disposed)
        this.onError(
          'WebSocket disconnected. Start a new session to reconnect.',
        );
    };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Signaling connection timed out.'));
        socket.close();
      }, 10_000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            'Cannot reach the signaling server. Check its address and try again.',
          ),
        );
      };
      socket.addEventListener(
        'close',
        () => {
          clearTimeout(timer);
          reject(new Error('WebSocket disconnected.'));
        },
        { once: true },
      );
    });
    if (this.disposed) throw new Error('Session closed.');
    this.heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) this.send({ type: 'ping' });
    }, 25_000);
  }
  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN)
      throw new Error('WebSocket disconnected.');
    this.socket.send(JSON.stringify(clientMessageSchema.parse(message)));
  }
  close() {
    this.disposed = true;
    clearInterval(this.heartbeat);
    this.socket?.close();
  }
}
