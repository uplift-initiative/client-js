import { HttpClient } from './http';
import { TTS } from './tts';
import { STT } from './stt';
import { UpliftAIError } from './errors';
import type { UpliftAIOptions } from './types';

const DEFAULT_BASE_URL = 'https://api.upliftai.org';

export class UpliftAI {
  readonly tts: TTS;
  readonly stt: STT;

  constructor(options: UpliftAIOptions = {}) {
    const apiKey = options.apiKey ?? process.env.UPLIFTAI_API_KEY;
    if (!apiKey) {
      throw new UpliftAIError(
        'apiKey is required. Pass it in options or set the UPLIFTAI_API_KEY environment variable.',
        undefined,
        'invalid_config',
      );
    }

    const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const http = new HttpClient({
      baseUrl,
      apiKey,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });

    const wsBaseUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');

    this.tts = new TTS(http, apiKey, baseUrl, wsBaseUrl);
    this.stt = new STT(http);
  }
}
