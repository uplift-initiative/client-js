import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// We need to mock ws before importing TTSWebSocketImpl
class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 1;
  send = vi.fn();
  close = vi.fn();

  constructor(_url: string, _options: unknown) {
    super();
    // Emit ready asynchronously
    queueMicrotask(() => {
      this.emit('message', JSON.stringify({
        type: 'ready',
        sessionId: 'test-session-123',
      }));
    });
  }
}

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

// Import after mock setup
const { TTSWebSocketImpl } = await import('../ws');

describe('TTSWebSocket', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connects and receives sessionId on ready', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    expect(ws.sessionId).toBe('test-session-123');
    expect(ws.readyState).toBe('open');
  });

  it('stream sends correct message and returns stream', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const stream = ws.stream({
      text: 'hello world',
      voiceId: 'v_meklc281',
      outputFormat: 'PCM_22050_16',
    });

    expect(stream.requestId).toBeDefined();

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;
    const sentMsg = JSON.parse(internalWs.send.mock.calls[0][0]);
    expect(sentMsg.type).toBe('synthesize');
    expect(sentMsg.text).toBe('hello world');
    expect(sentMsg.voiceId).toBe('v_meklc281');
    expect(sentMsg.requestId).toBe(stream.requestId);
  });

  it('demuxes audio events by requestId', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const stream = ws.stream({
      text: 'test',
      voiceId: 'v_meklc281',
      requestId: 'req_1',
    });

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;

    internalWs.emit('message', JSON.stringify({
      type: 'audio_start',
      requestId: 'req_1',
      timestamp: 1000,
    }));

    internalWs.emit('message', JSON.stringify({
      type: 'audio',
      requestId: 'req_1',
      sequence: 0,
      audio: Buffer.from('chunk1').toString('base64'),
    }));

    internalWs.emit('message', JSON.stringify({
      type: 'audio_end',
      requestId: 'req_1',
      timestamp: 2000,
    }));

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('audio_start');
    expect(events[1].type).toBe('audio');
    expect(events[2].type).toBe('audio_end');

    if (events[1].type === 'audio') {
      expect(Buffer.isBuffer(events[1].audio)).toBe(true);
      expect(events[1].audio.toString()).toBe('chunk1');
    }
  });

  it('ignores events for unknown requestIds', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const stream = ws.stream({
      text: 'test',
      voiceId: 'v_meklc281',
      requestId: 'req_1',
    });

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;

    internalWs.emit('message', JSON.stringify({
      type: 'audio',
      requestId: 'req_OTHER',
      sequence: 0,
      audio: Buffer.from('other').toString('base64'),
    }));

    internalWs.emit('message', JSON.stringify({
      type: 'audio_start',
      requestId: 'req_1',
      timestamp: 1000,
    }));

    internalWs.emit('message', JSON.stringify({
      type: 'audio_end',
      requestId: 'req_1',
      timestamp: 2000,
    }));

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('audio_start');
    expect(events[1].type).toBe('audio_end');
  });

  it('cancel sends cancel message and ends stream', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const stream = ws.stream({
      text: 'long text',
      voiceId: 'v_meklc281',
      requestId: 'req_cancel',
    });

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;

    internalWs.emit('message', JSON.stringify({
      type: 'audio_start',
      requestId: 'req_cancel',
      timestamp: 1000,
    }));

    const iter = stream[Symbol.asyncIterator]();
    const first = await iter.next();
    expect(first.value.type).toBe('audio_start');

    await stream.cancel();

    const cancelMsg = JSON.parse(internalWs.send.mock.calls[internalWs.send.mock.calls.length - 1][0]);
    expect(cancelMsg.type).toBe('cancel');
    expect(cancelMsg.requestId).toBe('req_cancel');

    const next = await iter.next();
    expect(next.done).toBe(true);
  });

  it('handles error events from server', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const stream = ws.stream({
      text: 'test',
      voiceId: 'v_meklc281',
      requestId: 'req_err',
    });

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;

    internalWs.emit('message', JSON.stringify({
      type: 'error',
      requestId: 'req_err',
      code: 'synthesis_failed',
      message: 'Internal error',
    }));

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].code).toBe('synthesis_failed');
      expect(events[0].message).toBe('Internal error');
    }
  });

  it('emits close listener on connection close', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const closeHandler = vi.fn();
    ws.on('close', closeHandler);

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;
    internalWs.emit('close', 1000, Buffer.from('normal'));

    expect(closeHandler).toHaveBeenCalledWith(1000, 'normal');
  });

  it('emits error listener on connection error', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const errorHandler = vi.fn();
    ws.on('error', errorHandler);

    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;
    const err = new Error('connection failed');
    internalWs.emit('error', err);

    expect(errorHandler).toHaveBeenCalledWith(err);
  });

  it('activeStreams reflects number of in-flight streams', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    expect(ws.activeStreams).toBe(0);

    const s1 = ws.stream({ text: 'first', voiceId: 'v_1', requestId: 'req_a1' });
    const s2 = ws.stream({ text: 'second', voiceId: 'v_1', requestId: 'req_a2' });

    expect(ws.activeStreams).toBe(2);

    // End s1 via audio_end
    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;
    internalWs.emit('message', JSON.stringify({ type: 'audio_end', requestId: 'req_a1', timestamp: 1000 }));

    // Drain s1 iterator
    for await (const _ of s1) { /* consume */ }

    expect(ws.activeStreams).toBe(1);

    await s2.cancel();
    expect(ws.activeStreams).toBe(0);
  });

  it('cancelAll cancels all in-flight streams and sends cancel messages', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    const s1 = ws.stream({ text: 'first', voiceId: 'v_1', requestId: 'req_c1' });
    const s2 = ws.stream({ text: 'second', voiceId: 'v_1', requestId: 'req_c2' });
    const s3 = ws.stream({ text: 'third', voiceId: 'v_1', requestId: 'req_c3' });

    expect(ws.activeStreams).toBe(3);

    ws.cancelAll();

    expect(ws.activeStreams).toBe(0);

    // All iterators should be done
    const r1 = await s1[Symbol.asyncIterator]().next();
    const r2 = await s2[Symbol.asyncIterator]().next();
    const r3 = await s3[Symbol.asyncIterator]().next();
    expect(r1.done).toBe(true);
    expect(r2.done).toBe(true);
    expect(r3.done).toBe(true);

    // Verify cancel messages were sent for each stream
    const internalWs = (ws as unknown as { ws: MockWebSocket }).ws;
    const cancelCalls = internalWs.send.mock.calls
      .map((c: string[]) => JSON.parse(c[0]))
      .filter((m: Record<string, unknown>) => m.type === 'cancel');

    expect(cancelCalls).toHaveLength(3);
    const cancelledIds = cancelCalls.map((m: Record<string, string>) => m.requestId).sort();
    expect(cancelledIds).toEqual(['req_c1', 'req_c2', 'req_c3']);
  });

  it('cancelAll is safe to call with no active streams', async () => {
    const ws = new TTSWebSocketImpl('wss://test.com/ws', 'sk_test');
    await ws.waitForReady();

    expect(() => ws.cancelAll()).not.toThrow();
    expect(ws.activeStreams).toBe(0);
  });
});
