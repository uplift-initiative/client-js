import { describe, it, expect, afterEach } from 'vitest';
import { UpliftAI, UpliftAIError } from '../index';

describe('UpliftAI Client', () => {
  const originalEnv = process.env.UPLIFTAI_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.UPLIFTAI_API_KEY = originalEnv;
    } else {
      delete process.env.UPLIFTAI_API_KEY;
    }
  });

  it('requires an API key', () => {
    delete process.env.UPLIFTAI_API_KEY;
    expect(() => new UpliftAI({ apiKey: '' })).toThrow(UpliftAIError);
    expect(() => new UpliftAI({ apiKey: '' })).toThrow('apiKey is required');
    expect(() => new UpliftAI()).toThrow(UpliftAIError);
  });

  it('falls back to UPLIFTAI_API_KEY env var', () => {
    process.env.UPLIFTAI_API_KEY = 'sk_from_env';
    const client = new UpliftAI();
    expect(client.tts).toBeDefined();
    expect(client.stt).toBeDefined();
  });

  it('accepts timeout and maxRetries options', () => {
    const client = new UpliftAI({
      apiKey: 'sk_test_123',
      timeout: 60000,
      maxRetries: 5,
    });
    expect(client.tts).toBeDefined();
  });

  it('creates a client with default baseUrl', () => {
    const client = new UpliftAI({ apiKey: 'sk_test_123' });
    expect(client.tts).toBeDefined();
    expect(client.stt).toBeDefined();
  });

  it('creates a client with custom baseUrl', () => {
    const client = new UpliftAI({
      apiKey: 'sk_test_123',
      baseUrl: 'https://custom.api.com',
    });
    expect(client.tts).toBeDefined();
    expect(client.stt).toBeDefined();
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new UpliftAI({
      apiKey: 'sk_test_123',
      baseUrl: 'https://custom.api.com/',
    });
    expect(client.tts).toBeDefined();
  });

  it('exposes phrase replacements sub-resource on tts', () => {
    const client = new UpliftAI({ apiKey: 'sk_test_123' });
    expect(client.tts.phraseReplacements).toBeDefined();
    expect(typeof client.tts.phraseReplacements.create).toBe('function');
    expect(typeof client.tts.phraseReplacements.get).toBe('function');
    expect(typeof client.tts.phraseReplacements.list).toBe('function');
    expect(typeof client.tts.phraseReplacements.update).toBe('function');
  });
});

describe('UpliftAIError', () => {
  it('has correct name and properties', () => {
    const err = new UpliftAIError('test error', 500, 'test_code');
    expect(err.name).toBe('UpliftAIError');
    expect(err.message).toBe('test error');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('test_code');
    expect(err).toBeInstanceOf(Error);
  });
});
