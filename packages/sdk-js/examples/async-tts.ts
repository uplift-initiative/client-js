/**
 * Async TTS — enqueue a job and retrieve audio later.
 *
 * Usage: UPLIFTAI_API_KEY=sk_... npx tsx examples/async-tts.ts
 */
import { createWriteStream } from 'node:fs';
import { UpliftAI } from '../src/index';

const client = new UpliftAI();

async function main() {
  console.log('Enqueuing async TTS job...');
  const { mediaId, temporaryUrl } = await client.tts.enqueue({
    text: 'یہ ایک async ٹیسٹ ہے۔ آڈیو بعد میں حاصل کی جائے گی۔',
    voiceId: 'v_meklc281',
    outputFormat: 'MP3_22050_64',
  });

  console.log(`mediaId: ${mediaId}`);
  // Pass this URL to a frontend or external system (e.g. WhatsApp) — no auth needed
  console.log(`temporaryUrl: ${temporaryUrl}`);

  console.log('Retrieving audio...');
  const { stream, metadata } = await client.tts.retrieve(mediaId);
  console.log(`Content-Type: ${metadata.contentType}, Sample Rate: ${metadata.sampleRate}`);

  const outPath = '/tmp/uplift-async-test.mp3';
  const fileStream = createWriteStream(outPath);
  let totalBytes = 0;

  for await (const chunk of stream) {
    totalBytes += (chunk as Buffer).length;
    fileStream.write(chunk);
  }

  fileStream.end();
  console.log(`Retrieved ${totalBytes} bytes -> ${outPath}`);
}

main().catch(console.error);
