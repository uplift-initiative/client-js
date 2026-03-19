import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { HttpClient } from './http';
import { UpliftAIError } from './errors';
import type { TranscriptionRequest, TranscriptionResponse } from './types';

async function streamToBuffer(stream: NodeJS.ReadableStream | Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      throw new UpliftAIError('Unexpected chunk type in audio stream');
    }
  }
  return Buffer.concat(chunks);
}

/** Speech-to-text resource. Access via `client.stt`. */
export class STT {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Transcribe audio to text.
   *
   * Accepts a file path, Buffer, or readable stream as input.
   *
   * @example
   * // From file path (extension used for content-type detection)
   * const { transcript } = await client.stt.transcribe({ file: './call.mp3', model: 'scribe' });
   *
   * // From Buffer (pass fileName so the server knows the format)
   * const { transcript } = await client.stt.transcribe({ file: audioBuffer, fileName: 'call.mp3', language: 'ur' });
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const formData = new FormData();

    if (typeof request.file === 'string') {
      const stream = createReadStream(request.file);
      const buffer = await streamToBuffer(stream);
      formData.append('file', new Blob([buffer]), basename(request.file));
    } else if (Buffer.isBuffer(request.file)) {
      formData.append('file', new Blob([request.file]), request.fileName);
    } else {
      const buffer = await streamToBuffer(request.file as Readable);
      formData.append('file', new Blob([buffer]), request.fileName);
    }

    if (request.model) formData.append('model', request.model);
    if (request.language) formData.append('language', request.language);
    if (request.domain) formData.append('domain', request.domain);

    const { data } = await this.http.postMultipart<TranscriptionResponse>(
      '/v1/transcribe/speech-to-text',
      formData,
    );

    return data;
  }
}
