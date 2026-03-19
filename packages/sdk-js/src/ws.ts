import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type {
  TTSRequest,
  TTSStream,
  TTSStreamEvent,
  TTSWebSocket,
  WSReadyState,
} from './types';
import { UpliftAIError } from './errors';

interface PendingStream {
  push(event: TTSStreamEvent): void;
  end(): void;
  error(err: Error): void;
}

/**
 * WebSocket-based TTS client. Supports multiple concurrent streams on a
 * single connection, multiplexed by requestId.
 *
 * Scope one connection per conversation or user session. Don't share a
 * single connection across unrelated contexts — we may leverage
 * connection-level state for prosody continuity in the future.
 *
 * Created via `client.tts.connect()` — do not instantiate directly.
 */
export class TTSWebSocketImpl implements TTSWebSocket {
  private ws: WebSocket;
  private _sessionId = '';
  private streams = new Map<string, PendingStream>();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;
  private listeners: { error: ((error: Error) => void)[]; close: ((code: number, reason: string) => void)[] } = {
    error: [],
    close: [],
  };

  constructor(url: string, apiKey: string) {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    this.ws.on('message', (raw: WebSocket.Data) => {
      this.handleMessage(raw);
    });

    this.ws.on('error', (err: Error) => {
      this.readyReject(err);
      for (const listener of this.listeners.error) {
        try { listener(err); } catch (e) { process.emitWarning(`Error in listener callback: ${e}`, 'UpliftAI'); }
      }
      for (const stream of this.streams.values()) stream.error(err);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString();
      for (const listener of this.listeners.close) {
        try { listener(code, reasonStr); } catch (e) { process.emitWarning(`Error in listener callback: ${e}`, 'UpliftAI'); }
      }
      for (const stream of this.streams.values()) {
        stream.error(new UpliftAIError(`WebSocket closed: ${code} ${reasonStr}`));
      }
      this.streams.clear();
    });
  }

  /** @internal Wait for the server `ready` message. Called by `tts.connect()`. */
  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Current connection state. */
  get readyState(): WSReadyState {
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }

  /** Server-assigned session ID, available after connection is ready. */
  get sessionId(): string {
    return this._sessionId;
  }

  /** Register a listener for connection-level events. */
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: (code: number, reason: string) => void): this;
  on(event: 'error' | 'close', listener: ((error: Error) => void) | ((code: number, reason: string) => void)): this {
    if (event === 'error') {
      this.listeners.error.push(listener as (error: Error) => void);
    } else {
      this.listeners.close.push(listener as (code: number, reason: string) => void);
    }
    return this;
  }

  /**
   * Start a TTS stream. Sends text to the server and returns an async iterable
   * of audio events (`audio_start`, `audio`, `audio_end`, `error`).
   *
   * Multiple streams can run concurrently on the same connection — each is
   * demuxed by its `requestId`. For real-time conversational AI, break your
   * LLM output into sentence-sized chunks and stream each one as it arrives.
   * This gives the lowest time-to-first-audio since synthesis starts before
   * the LLM finishes generating. If you use LiveKit, the UpliftAI plugin
   * handles this sentence segmentation automatically.
   *
   * **Connection scope:** Use one WebSocket per conversation / user session.
   * Don't multiplex unrelated use cases on a single connection — we may use
   * connection-level context for prosody and other improvements in the future.
   *
   * @example // Simple usage
   * const stream = ws.stream({ text: 'سلام', voiceId: 'v_meklc281' });
   * for await (const event of stream) {
   *   if (event.type === 'audio') speaker.write(event.audio);
   * }
   *
   * @example // Real-time: stream sentence-by-sentence as LLM generates
   * for await (const sentence of llm.streamSentences(prompt)) {
   *   const stream = ws.stream({ text: sentence, voiceId });
   *   for await (const event of stream) {
   *     if (event.type === 'audio') speaker.write(event.audio);
   *   }
   * }
   *
   * @example // Overlap: fire next sentence before previous finishes
   * const sentences = ['پہلا جملہ۔', 'دوسرا جملہ۔', 'تیسرا جملہ۔'];
   * for (const sentence of sentences) {
   *   const stream = ws.stream({ text: sentence, voiceId });
   *   consume(stream); // don't await — let them overlap
   * }
   */
  stream(request: TTSRequest & { requestId?: string }): TTSStream {
    const requestId = request.requestId ?? randomUUID();

    const buffer: TTSStreamEvent[] = [];
    let resolve: ((value: IteratorResult<TTSStreamEvent>) => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const cleanup = () => {
      this.streams.delete(requestId);
      buffer.length = 0;
      resolve = null;
    };

    const pending: PendingStream = {
      push(event: TTSStreamEvent) {
        if (done) return;
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: event, done: false });
        } else {
          buffer.push(event);
        }
      },
      end() {
        if (done) return;
        done = true;
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: undefined as unknown as TTSStreamEvent, done: true });
        }
      },
      error(err: Error) {
        if (done) return;
        error = err;
        done = true;
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: undefined as unknown as TTSStreamEvent, done: true });
        }
      },
    };

    this.streams.set(requestId, pending);

    this.safeSend({
      type: 'synthesize',
      requestId,
      text: request.text,
      voiceId: request.voiceId,
      outputFormat: request.outputFormat ?? 'PCM_22050_16',
    });

    const iterator: AsyncIterableIterator<TTSStreamEvent> = {
      next(): Promise<IteratorResult<TTSStreamEvent>> {
        if (error || done) {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift()!, done: false });
          }
          cleanup();
          return Promise.resolve({ value: undefined as unknown as TTSStreamEvent, done: true });
        }
        if (buffer.length > 0) {
          return Promise.resolve({ value: buffer.shift()!, done: false });
        }
        return new Promise<IteratorResult<TTSStreamEvent>>((r) => {
          resolve = r;
        });
      },
      return(): Promise<IteratorResult<TTSStreamEvent>> {
        done = true;
        cleanup();
        return Promise.resolve({ value: undefined as unknown as TTSStreamEvent, done: true });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    const stream: TTSStream = {
      requestId,
      /** Cancel this stream. Tells the server to stop generating and ends the iterator. */
      cancel: async () => {
        this.safeSend({ type: 'cancel', requestId });
        cleanup();
        pending.end();
      },
      [Symbol.asyncIterator]() {
        return iterator;
      },
    };

    return stream;
  }

  /**
   * Cancel all in-flight streams. Use for barge-in / interruption — when the
   * user starts speaking and you need to immediately stop all TTS playback.
   *
   * Sends a cancel message to the server for each active stream and ends
   * all iterators synchronously.
   *
   * @example
   * ws.stream({ text: 'sentence 1...', voiceId });
   * ws.stream({ text: 'sentence 2...', voiceId });
   * // User interrupts!
   * ws.cancelAll(); // both streams end immediately
   */
  cancelAll(): void {
    for (const [requestId, stream] of this.streams) {
      this.safeSend({ type: 'cancel', requestId });
      stream.end();
    }
    this.streams.clear();
  }

  /** Number of streams currently in-flight on this connection. */
  get activeStreams(): number {
    return this.streams.size;
  }

  /** Close the WebSocket connection. */
  close(): void {
    this.ws.close();
  }

  private safeSend(msg: Record<string, unknown>): void {
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      for (const stream of this.streams.values()) {
        stream.error(new UpliftAIError(`WebSocket send failed: ${error.message}`));
      }
    }
  }

  private handleMessage(raw: WebSocket.Data): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const type = msg.type as string;

    if (type === 'ready') {
      this._sessionId = msg.sessionId as string;
      this.readyResolve();
      return;
    }

    const requestId = msg.requestId as string;
    if (!requestId) return;

    const stream = this.streams.get(requestId);
    if (!stream) return;

    switch (type) {
      case 'audio_start':
        stream.push({
          type: 'audio_start',
          requestId,
          timestamp: msg.timestamp as number,
        });
        break;

      case 'audio': {
        let audio: Buffer;
        try {
          audio = Buffer.from(msg.audio as string, 'base64');
        } catch {
          stream.push({
            type: 'error',
            requestId,
            code: 'decode_error',
            message: 'Failed to decode base64 audio data',
          });
          stream.end();
          this.streams.delete(requestId);
          return;
        }
        stream.push({
          type: 'audio',
          requestId,
          sequence: msg.sequence as number,
          audio,
        });
        break;
      }

      case 'audio_end':
        stream.push({
          type: 'audio_end',
          requestId,
          timestamp: msg.timestamp as number,
        });
        stream.end();
        this.streams.delete(requestId);
        break;

      case 'error':
        stream.push({
          type: 'error',
          requestId,
          code: msg.code as string,
          message: msg.message as string,
        });
        stream.end();
        this.streams.delete(requestId);
        break;
    }
  }
}
