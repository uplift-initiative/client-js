import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpliftAI } from '../index';

describe('TTS', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchWithAudio() {
    const audioBytes = Buffer.from('fake-audio-data');
    const mockResponse = {
      ok: true,
      status: 200,
      arrayBuffer: async () => audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength),
      headers: new Headers({
        'x-uplift-ai-audio-duration': '2500',
        'content-type': 'audio/mpeg',
        'x-uplift-ai-sample-rate': '22050',
        'x-uplift-ai-bit-rate': '128000',
      }),
    } as unknown as Response;

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
    return globalThis.fetch as ReturnType<typeof vi.fn>;
  }

  function mockFetchWithJSON(body: unknown) {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => body,
      headers: new Headers(),
    } as unknown as Response;

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
    return globalThis.fetch as ReturnType<typeof vi.fn>;
  }

  describe('create', () => {
    it('sends correct request and parses audio response', async () => {
      const fetchMock = mockFetchWithAudio();
      const client = new UpliftAI({ apiKey: 'sk_test' });

      const result = await client.tts.create({
        text: 'السلام علیکم',
        voiceId: 'v_meklc281',
        outputFormat: 'MP3_22050_128',
      });

      expect(Buffer.isBuffer(result.audio)).toBe(true);
      expect(result.metadata.duration).toBe(2500);
      expect(result.metadata.contentType).toBe('audio/mpeg');
      expect(result.metadata.sampleRate).toBe(22050);
      expect(result.metadata.bitRate).toBe(128000);

      const callArgs = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toContain('/v1/synthesis/text-to-speech');
      const sentBody = JSON.parse(callArgs[1].body);
      expect(sentBody.text).toBe('السلام علیکم');
      expect(sentBody.voiceId).toBe('v_meklc281');
      expect(sentBody.outputFormat).toBe('MP3_22050_128');
    });

    it('defaults outputFormat to WAV_22050_32 when not provided', async () => {
      const fetchMock = mockFetchWithAudio();
      const client = new UpliftAI({ apiKey: 'sk_test' });

      await client.tts.create({
        text: 'hello',
        voiceId: 'v_meklc281',
      });

      const sentBody = JSON.parse((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(sentBody.outputFormat).toBe('WAV_22050_32');
      expect(sentBody).not.toHaveProperty('phraseReplacementConfigId');
    });
  });

  describe('enqueue (async)', () => {
    it('returns mediaId, token, and temporaryUrl', async () => {
      mockFetchWithJSON({ mediaId: 'media_123', token: 'tok_abc' });
      const client = new UpliftAI({ apiKey: 'sk_test' });

      const result = await client.tts.enqueue({
        text: 'async test',
        voiceId: 'v_meklc281',
        outputFormat: 'MP3_22050_64',
      });

      expect(result.mediaId).toBe('media_123');
      expect(result.token).toBe('tok_abc');
      expect(result.temporaryUrl).toBe(
        'https://api.upliftai.org/v1/synthesis/stream-audio/media_123?token=tok_abc',
      );
    });

    it('respects custom baseUrl in temporaryUrl', async () => {
      mockFetchWithJSON({ mediaId: 'media_789', token: 'tok_xyz' });
      const client = new UpliftAI({ apiKey: 'sk_test', baseUrl: 'https://custom.host.io' });

      const result = await client.tts.enqueue({
        text: 'test',
        voiceId: 'v_meklc281',
      });

      expect(result.temporaryUrl).toBe(
        'https://custom.host.io/v1/synthesis/stream-audio/media_789?token=tok_xyz',
      );
    });
  });

  describe('enqueueStream (async streaming)', () => {
    it('calls the stream-async endpoint and returns temporaryUrl', async () => {
      const fetchMock = mockFetchWithJSON({ mediaId: 'media_456', token: 'tok_def' });
      const client = new UpliftAI({ apiKey: 'sk_test' });

      const result = await client.tts.enqueueStream({
        text: 'streaming test',
        voiceId: 'v_meklc281',
      });

      expect(result.mediaId).toBe('media_456');
      expect(result.temporaryUrl).toContain('/stream-audio/media_456?token=tok_def');
      const callUrl = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callUrl).toContain('/v1/synthesis/text-to-speech/stream-async');
    });
  });

  describe('createStream', () => {
    it('returns a readable stream', async () => {
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
      let chunkIdx = 0;

      const mockReadableStream = {
        getReader: () => ({
          read: async () => {
            if (chunkIdx < chunks.length) {
              return { value: chunks[chunkIdx++], done: false };
            }
            return { value: undefined, done: true };
          },
          cancel: async () => {},
        }),
      } as unknown as ReadableStream<Uint8Array>;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream,
        headers: new Headers({
          'x-uplift-ai-request-id': 'req_stream_123',
          'content-type': 'audio/pcm',
        }),
      });

      const client = new UpliftAI({ apiKey: 'sk_test' });
      const { stream, metadata } = await client.tts.createStream({
        text: 'streaming',
        voiceId: 'v_meklc281',
      });

      expect(metadata.requestId).toBe('req_stream_123');
      expect(metadata.contentType).toBe('audio/pcm');

      const received: Buffer[] = [];
      for await (const chunk of stream) {
        received.push(chunk as Buffer);
      }

      expect(received.length).toBeGreaterThanOrEqual(1);
      expect(Buffer.concat(received)).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
    });
  });
});
