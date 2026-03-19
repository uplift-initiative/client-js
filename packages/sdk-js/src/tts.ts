import { Readable } from 'node:stream';
import { HttpClient } from './http';
import { PhraseReplacements } from './phrase-replacements';
import { TTSWebSocketImpl } from './ws';
import type {
  TTSRequest,
  AudioResponse,
  AudioMetadata,
  EnqueueResponse,
  StreamResponse,
  TTSWebSocket,
} from './types';

const DEFAULT_OUTPUT_FORMAT = 'WAV_22050_32';

function buildTTSBody(request: TTSRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    text: request.text,
    voiceId: request.voiceId,
    outputFormat: request.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
  };
  if (request.phraseReplacementConfigId) body.phraseReplacementConfigId = request.phraseReplacementConfigId;
  return body;
}

function parseAudioMetadata(headers: Headers): AudioMetadata {
  return {
    requestId: headers.get('x-uplift-ai-request-id') ?? '',
    duration: Number(headers.get('x-uplift-ai-audio-duration') ?? 0),
    contentType: headers.get('content-type') ?? 'application/octet-stream',
    sampleRate: Number(headers.get('x-uplift-ai-sample-rate') ?? 0),
    bitRate: Number(headers.get('x-uplift-ai-bit-rate') ?? 0),
  };
}

function readableFromWeb(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    },
    destroy(_err, callback) {
      reader.cancel().then(() => callback(null), callback);
    },
  });
}

/** Text-to-speech resource. Access via `client.tts`. */
export class TTS {
  private http: HttpClient;
  private apiKey: string;
  private baseUrl: string;
  private wsBaseUrl: string;

  /** Manage phrase replacement configs for pronunciation control. */
  readonly phraseReplacements: PhraseReplacements;

  constructor(http: HttpClient, apiKey: string, baseUrl: string, wsBaseUrl: string) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.wsBaseUrl = wsBaseUrl;
    this.phraseReplacements = new PhraseReplacements(http);
  }

  /**
   * Synthesize text and return the full audio buffer.
   *
   * Generates the complete audio before returning. Faster end-to-end than
   * streaming, but the caller must wait for the entire file. Best for
   * batch/offline use cases where latency to first byte doesn't matter.
   *
   * @example
   * const { audio, metadata } = await client.tts.create({ text: 'سلام', voiceId: 'v_meklc281' });
   * fs.writeFileSync('output.mp3', audio);
   */
  async create(request: TTSRequest): Promise<AudioResponse> {
    const { buffer, headers } = await this.http.postJSONForBuffer(
      '/v1/synthesis/text-to-speech',
      buildTTSBody(request),
    );
    return {
      audio: buffer,
      metadata: parseAudioMetadata(headers),
    };
  }

  /**
   * Synthesize text and return a readable stream of audio chunks.
   *
   * The first chunk arrives quickly, but total generation is slower than
   * `create()`. Use this in latency-sensitive environments like live agents,
   * phone calls, or real-time playback where you want audio to start playing
   * immediately rather than waiting for the full file.
   *
   * @example
   * const { stream, metadata } = await client.tts.createStream({ text: 'سلام', voiceId: 'v_meklc281' });
   * for await (const chunk of stream) speaker.write(chunk);
   */
  async createStream(request: TTSRequest): Promise<StreamResponse> {
    const { body, headers } = await this.http.postJSONForStream(
      '/v1/synthesis/text-to-speech/stream',
      buildTTSBody(request),
    );
    return {
      stream: readableFromWeb(body),
      metadata: parseAudioMetadata(headers),
    };
  }

  /**
   * Enqueue an async TTS job. Returns a `mediaId` to retrieve the audio later.
   *
   * Use for batch processing or when you don't need audio immediately.
   * Poll or call `retrieve(mediaId)` when the audio is ready.
   *
   * @example
   * const { mediaId, temporaryUrl } = await client.tts.enqueue({ text: 'سلام', voiceId: 'v_meklc281' });
   * // retrieve server-side
   * const audio = await client.tts.retrieve(mediaId);
   * // or pass URL directly to a client/browser
   * console.log(temporaryUrl);
   */
  async enqueue(request: TTSRequest): Promise<EnqueueResponse> {
    const { data } = await this.http.postJSON<{ mediaId: string; token: string }>(
      '/v1/synthesis/text-to-speech-async',
      buildTTSBody(request),
    );
    return {
      ...data,
      temporaryUrl: this.buildTemporaryUrl(data.mediaId, data.token),
    };
  }

  /**
   * Enqueue an async TTS job with streaming retrieval.
   *
   * Same as `enqueue()`, but when retrieved via `retrieve(mediaId)` the audio
   * streams in chunks instead of arriving as a single buffer.
   *
   * @example
   * const { mediaId, temporaryUrl } = await client.tts.enqueueStream({ text: 'سلام', voiceId: 'v_meklc281' });
   * const stream = await client.tts.retrieve(mediaId);
   * for await (const chunk of stream) speaker.write(chunk);
   */
  async enqueueStream(request: TTSRequest): Promise<EnqueueResponse> {
    const { data } = await this.http.postJSON<{ mediaId: string; token: string }>(
      '/v1/synthesis/text-to-speech/stream-async',
      buildTTSBody(request),
    );
    return {
      ...data,
      temporaryUrl: this.buildTemporaryUrl(data.mediaId, data.token),
    };
  }

  /**
   * Retrieve audio from a previously enqueued job.
   *
   * Returns the audio stream along with metadata (encoding, sample rate, etc.)
   * from response headers.
   *
   * @example
   * const { stream, metadata } = await client.tts.retrieve('<mediaId from enqueue>');
   * console.log(metadata.contentType); // 'audio/mpeg'
   * for await (const chunk of stream) fs.appendFileSync('out.mp3', chunk);
   */
  async retrieve(mediaId: string): Promise<StreamResponse> {
    const { body, headers } = await this.http.getStream(`/v1/synthesis/stream-audio/${mediaId}`);
    return {
      stream: readableFromWeb(body),
      metadata: parseAudioMetadata(headers),
    };
  }

  /**
   * Open a persistent WebSocket connection for low-latency streaming TTS.
   *
   * Supports multiple concurrent streams on one connection, multiplexed by
   * requestId. Use for real-time conversational AI, live agents, and
   * interactive use cases. Resolves once the connection is ready.
   *
   * Open one connection per conversation or user session — don't share across
   * unrelated contexts.
   *
   * @example
   * const ws = await client.tts.connect();
   * // Stream sentence-by-sentence as your LLM generates
   * for await (const sentence of llm.streamSentences(prompt)) {
   *   const stream = ws.stream({ text: sentence, voiceId: 'v_meklc281' });
   *   for await (const event of stream) {
   *     if (event.type === 'audio') speaker.write(event.audio);
   *   }
   * }
   * ws.close();
   */
  private buildTemporaryUrl(mediaId: string, token: string): string {
    return `${this.baseUrl}/v1/synthesis/stream-audio/${mediaId}?token=${encodeURIComponent(token)}`;
  }

  async connect(): Promise<TTSWebSocket> {
    const wsUrl = `${this.wsBaseUrl}/v1/text-to-speech/multi-stream`;
    const ws = new TTSWebSocketImpl(wsUrl, this.apiKey);
    await ws.waitForReady();
    return ws;
  }
}
