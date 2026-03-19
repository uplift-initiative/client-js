/**
 * WebSocket TTS — connect and stream audio events.
 *
 * Usage: UPLIFTAI_API_KEY=sk_... npx tsx examples/websocket-tts.ts
 */
import { writeFileSync } from 'node:fs';
import { UpliftAI } from '../src/index';
import type { TTSStreamEvent } from '../src/types';

const client = new UpliftAI();

async function main() {
  console.log('Connecting WebSocket...');
  const ws = await client.tts.connect();
  console.log(`Connected! Session ID: ${ws.sessionId}`);

  ws.on('error', (err) => console.error('WS Error:', err));
  ws.on('close', (code, reason) => console.log(`WS Closed: ${code} ${reason}`));

  // Single request
  console.log('\n--- Single request ---');
  const audioChunks: Buffer[] = [];
  const stream = ws.stream({
    text: 'ویب ساکٹ سے سلام',
    voiceId: 'v_meklc281',
    outputFormat: 'PCM_22050_16',
  });

  for await (const event of stream) {
    switch (event.type) {
      case 'audio_start':
        console.log(`audio_start (requestId: ${event.requestId})`);
        break;
      case 'audio':
        audioChunks.push(event.audio);
        process.stdout.write(`\r  chunks: ${audioChunks.length}, bytes: ${audioChunks.reduce((s, c) => s + c.length, 0)}`);
        break;
      case 'audio_end':
        console.log(`\n  audio_end (requestId: ${event.requestId})`);
        break;
      case 'error':
        console.error(`  error: ${event.code} - ${event.message}`);
        break;
    }
  }

  const singleAudio = Buffer.concat(audioChunks);
  writeFileSync('/tmp/uplift-ws-single.pcm', singleAudio);
  console.log(`Written single request audio: ${singleAudio.length} bytes`);

  // Concurrent requests
  console.log('\n--- Concurrent requests ---');
  const s1 = ws.stream({ text: 'پہلا جملہ', voiceId: 'v_meklc281' });
  const s2 = ws.stream({ text: 'دوسرا جملہ', voiceId: 'v_meklc281' });

  console.log(`Active streams: ${ws.activeStreams}`);

  async function consumeStream(s: AsyncIterable<TTSStreamEvent>, label: string) {
    const chunks: Buffer[] = [];
    for await (const event of s) {
      if (event.type === 'audio') chunks.push(event.audio);
    }
    const total = Buffer.concat(chunks);
    console.log(`  ${label}: ${total.length} bytes`);
    return total;
  }

  await Promise.all([
    consumeStream(s1, 'stream 1'),
    consumeStream(s2, 'stream 2'),
  ]);

  // Demonstrate cancelAll (barge-in)
  console.log('\n--- Cancel all (barge-in) ---');
  ws.stream({ text: 'یہ جملہ منسوخ ہو جائے گا', voiceId: 'v_meklc281' });
  ws.stream({ text: 'یہ بھی منسوخ ہو جائے گا', voiceId: 'v_meklc281' });
  console.log(`Active streams before cancel: ${ws.activeStreams}`);
  ws.cancelAll();
  console.log(`Active streams after cancel: ${ws.activeStreams}`);

  ws.close();
  console.log('\nDone!');
}

main().catch(console.error);
