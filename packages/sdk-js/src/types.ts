export type OutputFormat =
  | 'PCM_22050_16'
  | 'WAV_22050_16'
  | 'WAV_22050_32'
  | 'MP3_22050_32'
  | 'MP3_22050_64'
  | 'MP3_22050_128'
  | 'OGG_22050_16'
  | 'ULAW_8000_8';

export interface TTSRequest {
  text: string;
  voiceId: string;
  outputFormat?: OutputFormat;
  phraseReplacementConfigId?: string;
}

export interface AudioMetadata {
  requestId: string;
  duration: number;
  contentType: string;
  sampleRate: number;
  bitRate: number;
}

export interface AudioResponse {
  audio: Buffer;
  metadata: AudioMetadata;
}

export interface StreamResponse {
  stream: import('node:stream').Readable;
  metadata: AudioMetadata;
}

/**
 * Result of enqueuing a TTS job. Use `mediaId` with `retrieve()` to fetch
 * the audio, or pass `temporaryUrl` directly to a frontend/client (e.g.
 * WhatsApp, browser audio element) without downloading first.
 */
export interface EnqueueResponse {
  mediaId: string;
  token: string;
  /** Pre-signed URL to stream audio directly — no auth required. Short-lived, do not persist. */
  temporaryUrl: string;
}

export interface WSAudioStart {
  type: 'audio_start';
  requestId: string;
  timestamp: number;
}

export interface WSAudio {
  type: 'audio';
  requestId: string;
  sequence: number;
  audio: Buffer;
}

export interface WSAudioEnd {
  type: 'audio_end';
  requestId: string;
  timestamp: number;
}

export interface WSError {
  type: 'error';
  requestId: string;
  code: string;
  message: string;
}

export type TTSStreamEvent = WSAudioStart | WSAudio | WSAudioEnd | WSError;

interface TranscriptionRequestBase {
  model?: 'scribe' | 'scribe-mini';
  language?: 'ur';
  domain?: 'phone-commerce' | 'farming';
}

export interface TranscriptionRequestFromPath extends TranscriptionRequestBase {
  /** Path to an audio file. Extension is used for content-type detection. */
  file: string;
  fileName?: never;
}

export interface TranscriptionRequestFromBuffer extends TranscriptionRequestBase {
  /** Audio data as a Buffer or readable stream. */
  file: Buffer | NodeJS.ReadableStream;
  /**
   * Filename hint for content-type detection on the server (e.g. `'call.mp3'`).
   * The extension tells the server what format the audio is in.
   */
  fileName: string;
}

export type TranscriptionRequest = TranscriptionRequestFromPath | TranscriptionRequestFromBuffer;

export interface TranscriptionResponse {
  transcript: string;
}

export interface PhraseReplacement {
  phrase: string;
  replacement: string;
}

export interface PhraseReplacementConfig {
  configId: string;
  phraseReplacements: PhraseReplacement[];
}

export interface UpliftAIOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface TTSStream extends AsyncIterable<TTSStreamEvent> {
  cancel(): Promise<void>;
  requestId: string;
}

export type WSReadyState = 'connecting' | 'open' | 'closing' | 'closed';

export interface TTSWebSocket {
  stream(request: TTSRequest & { requestId?: string }): TTSStream;
  cancelAll(): void;
  readonly activeStreams: number;
  close(): void;
  readonly readyState: WSReadyState;
  readonly sessionId: string;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: (code: number, reason: string) => void): this;
}
