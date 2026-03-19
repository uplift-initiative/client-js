import { UpliftAIAuthError, UpliftAIError, UpliftAIInsufficientBalanceError, UpliftAIRateLimitError } from './errors';

const SDK_VERSION = '0.1.1';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface HttpClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export class HttpClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': `upliftai-js/${SDK_VERSION}`,
      Connection: 'keep-alive',
      ...extra,
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit, retriesLeft = this.maxRetries): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      if (!res.ok && retriesLeft > 0 && RETRYABLE_STATUS_CODES.has(res.status)) {
        const delay = this.retryDelay(this.maxRetries - retriesLeft);
        await sleep(delay);
        return this.fetchWithRetry(url, init, retriesLeft - 1);
      }

      return res;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new UpliftAIError('Request timed out', undefined, 'timeout');
      }
      if (retriesLeft > 0) {
        const delay = this.retryDelay(this.maxRetries - retriesLeft);
        await sleep(delay);
        return this.fetchWithRetry(url, init, retriesLeft - 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private retryDelay(attempt: number): number {
    const base = Math.min(500 * Math.pow(2, attempt), 5000);
    const jitter = base * 0.25 * Math.random();
    return base + jitter;
  }

  async postJSON<T>(path: string, body: Record<string, unknown>): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }

  async postJSONForBuffer(path: string, body: Record<string, unknown>): Promise<{ buffer: Buffer; headers: Headers }> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, headers: res.headers };
  }

  async postJSONForStream(path: string, body: Record<string, unknown>): Promise<{ body: ReadableStream<Uint8Array>; headers: Headers }> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    if (!res.body) {
      throw new UpliftAIError('Response body is null');
    }

    return { body: res.body, headers: res.headers };
  }

  async postMultipart<T>(path: string, formData: FormData): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers(),
      body: formData,
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }

  async get<T>(path: string): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }

  async getStream(path: string, query?: Record<string, string>): Promise<{ body: ReadableStream<Uint8Array>; headers: Headers }> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: this.headers(),
    });

    if (!res.ok) {
      await this.throwForStatus(res);
    }

    if (!res.body) {
      throw new UpliftAIError('Response body is null');
    }

    return { body: res.body, headers: res.headers };
  }

  private async throwForStatus(res: Response): Promise<never> {
    const requestId = res.headers.get('x-uplift-ai-request-id') ?? undefined;
    const body = await this.safeText(res);
    if (res.status === 401) throw new UpliftAIAuthError(undefined, requestId);
    if (res.status === 402) throw new UpliftAIInsufficientBalanceError(undefined, requestId);
    if (res.status === 429) throw new UpliftAIRateLimitError(undefined, requestId);
    throw new UpliftAIError(`HTTP ${res.status}: ${body}`, res.status, undefined, requestId);
  }

  private async safeText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
