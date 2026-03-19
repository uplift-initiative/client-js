/**
 * Sync TTS — synthesize text and get full audio buffer.
 *
 * Usage: UPLIFTAI_API_KEY=sk_... npx tsx examples/sync-tts.ts
 */
import { writeFileSync } from 'node:fs';
import { UpliftAI } from '../src/index';

const client = new UpliftAI();

async function main() {
  console.log('Synthesizing audio...');
  const { audio, metadata } = await client.tts.create({
    text: 'السلام علیکم، یہ ایک ٹیسٹ ہے',
    voiceId: 'v_meklc281',
    outputFormat: 'MP3_22050_128',
  });

  const outPath = '/tmp/uplift-sync-test.mp3';
  writeFileSync(outPath, audio);
  console.log(`Audio written to ${outPath}`);
  console.log('Metadata:', metadata);
  console.log(`Audio size: ${audio.length} bytes`);
}

main().catch(console.error);
