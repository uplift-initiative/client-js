import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpliftAI } from '../index';

describe('STT', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockTranscribeResponse(text: string) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ transcript: text }),
      headers: new Headers(),
    });
    return globalThis.fetch as ReturnType<typeof vi.fn>;
  }

  it('transcribes a Buffer', async () => {
    const fetchMock = mockTranscribeResponse('ٹرانسکرپشن');
    const client = new UpliftAI({ apiKey: 'sk_test' });

    const result = await client.stt.transcribe({
      file: Buffer.from('fake-audio'),
      fileName: 'audio.wav',
      model: 'scribe',
      language: 'ur',
    });

    expect(result.transcript).toBe('ٹرانسکرپشن');
    const callArgs = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toContain('/v1/transcribe/speech-to-text');
    expect(callArgs[1].body).toBeInstanceOf(FormData);
  });

  it('sends model and language as form fields', async () => {
    const fetchMock = mockTranscribeResponse('test');
    const client = new UpliftAI({ apiKey: 'sk_test' });

    await client.stt.transcribe({
      file: Buffer.from('audio'),
      fileName: 'audio.mp3',
      model: 'scribe-mini',
      language: 'ur',
      domain: 'farming',
    });

    const sentFormData = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(sentFormData.get('model')).toBe('scribe-mini');
    expect(sentFormData.get('language')).toBe('ur');
    expect(sentFormData.get('domain')).toBe('farming');
  });

  it('omits optional fields when not provided', async () => {
    const fetchMock = mockTranscribeResponse('test');
    const client = new UpliftAI({ apiKey: 'sk_test' });

    await client.stt.transcribe({
      file: Buffer.from('audio'),
      fileName: 'audio.wav',
    });

    const sentFormData = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(sentFormData.get('model')).toBeNull();
    expect(sentFormData.get('language')).toBeNull();
    expect(sentFormData.get('domain')).toBeNull();
  });

  it('uses fileName for content-type detection', async () => {
    const fetchMock = mockTranscribeResponse('test');
    const client = new UpliftAI({ apiKey: 'sk_test' });

    await client.stt.transcribe({
      file: Buffer.from('audio'),
      fileName: 'recording.mp3',
    });

    const sentFormData = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    const file = sentFormData.get('file') as File;
    expect(file.name).toBe('recording.mp3');
  });
});
