/**
 * HTTP Streaming TTS — stream audio chunks to a file.
 *
 * Usage: UPLIFTAI_API_KEY=sk_... npx tsx examples/stream-tts.ts
 */
import { createWriteStream } from 'node:fs';
import { UpliftAI } from '../src/index';

const client = new UpliftAI();

async function main() {
  console.log('Streaming TTS audio...');
  const { stream, metadata } = await client.tts.createStream({
    text: 'اردو میں ایک لمبا جملہ، جو سٹریمنگ کی جانچ کے لیے ہے',
    voiceId: 'v_meklc281',
    outputFormat: 'MP3_22050_64',
  });

  console.log(`Request ID: ${metadata.requestId}`);
  console.log(`Content-Type: ${metadata.contentType}`);

  const outPath = '/tmp/uplift-stream-test.pcm';
  const fileStream = createWriteStream(outPath);
  let totalBytes = 0;

  for await (const chunk of stream) {
    totalBytes += (chunk as Buffer).length;
    fileStream.write(chunk);
    process.stdout.write(`\rReceived ${totalBytes} bytes`);
  }

  fileStream.end();
  console.log(`\nStream complete. Written to ${outPath} (${totalBytes} bytes)`);
}

main().catch(console.error);
