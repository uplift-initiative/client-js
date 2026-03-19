import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../http';
import { UpliftAIAuthError, UpliftAIInsufficientBalanceError, UpliftAIRateLimitError, UpliftAIError } from '../errors';

describe('HttpClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockResponse(status: number, body: unknown, headers?: Record<string, string>) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
      arrayBuffer: async () => {
        const str = JSON.stringify(body);
        const buf = Buffer.from(str);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      },
      headers: new Headers(headers),
      body: null,
    } as unknown as Response;
  }

  function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(status, body, headers));
    return globalThis.fetch as ReturnType<typeof vi.fn>;
  }

  // Disable retries for most tests to keep them fast
  function noRetryClient(opts?: Partial<{ baseUrl: string; apiKey: string }>) {
    return new HttpClient({
      baseUrl: opts?.baseUrl ?? 'https://api.test.com',
      apiKey: opts?.apiKey ?? 'sk_test',
      maxRetries: 0,
    });
  }

  it('sends Authorization and User-Agent headers on JSON POST', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    const client = noRetryClient();

    await client.postJSON('/test', { foo: 'bar' });

    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBe('Bearer sk_test');
    expect(callArgs.headers['User-Agent']).toMatch(/^upliftai-js\//);
    expect(callArgs.headers['Content-Type']).toBe('application/json');
  });

  it('sends Authorization header on GET', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    const client = noRetryClient();

    await client.get('/test');

    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBe('Bearer sk_test');
  });

  it('includes server request ID in error when available', async () => {
    mockFetch(401, { error: 'unauthorized' }, { 'x-uplift-ai-request-id': 'req_server_123' });
    const client = noRetryClient();

    try {
      await client.postJSON('/test', {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UpliftAIAuthError);
      expect((err as UpliftAIAuthError).requestId).toBe('req_server_123');
    }
  });

  it('parses JSON response from postJSON', async () => {
    mockFetch(200, { mediaId: 'abc', token: 'xyz' });
    const client = noRetryClient();

    const { data } = await client.postJSON<{ mediaId: string }>('/test', {});
    expect(data.mediaId).toBe('abc');
  });

  it('returns buffer from postJSONForBuffer', async () => {
    mockFetch(200, { data: 'audio' }, { 'x-uplift-ai-audio-duration': '1500' });
    const client = noRetryClient();

    const { buffer, headers } = await client.postJSONForBuffer('/test', {});
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(headers.get('x-uplift-ai-audio-duration')).toBe('1500');
  });

  it('throws UpliftAIAuthError on 401 (no retry)', async () => {
    mockFetch(401, { error: 'unauthorized' });
    const client = noRetryClient();

    await expect(client.postJSON('/test', {})).rejects.toThrow(UpliftAIAuthError);
  });

  it('throws UpliftAIInsufficientBalanceError on 402', async () => {
    mockFetch(402, { error: 'insufficient balance' });
    const client = noRetryClient();

    await expect(client.postJSON('/test', {})).rejects.toThrow(UpliftAIInsufficientBalanceError);
  });

  it('throws UpliftAIRateLimitError on 429 after retries exhausted', async () => {
    mockFetch(429, { error: 'rate limited' });
    const client = noRetryClient();

    await expect(client.postJSON('/test', {})).rejects.toThrow(UpliftAIRateLimitError);
  });

  it('throws UpliftAIError on 400 (non-retryable)', async () => {
    mockFetch(400, { error: 'bad request' });
    const client = noRetryClient();

    await expect(client.postJSON('/test', {})).rejects.toThrow(UpliftAIError);
  });

  it('retries on 500 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(500, { error: 'server error' }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    globalThis.fetch = fetchMock;

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      apiKey: 'sk_test',
      maxRetries: 1,
    });

    const { data } = await client.postJSON<{ ok: boolean }>('/test', {});
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetchMock = mockFetch(200, {});
    const client = noRetryClient({ baseUrl: 'https://api.test.com/' });

    await client.get('/path');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test.com/path',
      expect.anything(),
    );
  });

  it('sends multipart form data without Content-Type header', async () => {
    const fetchMock = mockFetch(200, { text: 'hello' });
    const client = noRetryClient();
    const formData = new FormData();
    formData.append('file', new Blob(['audio']), 'test.wav');

    await client.postMultipart('/test', formData);

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers).not.toHaveProperty('Content-Type');
    expect(callArgs[1].body).toBe(formData);
  });
});
