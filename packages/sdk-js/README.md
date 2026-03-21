# @upliftai/sdk-js

Official Node.js SDK for the [UpliftAI](https://upliftai.org) API. Build Urdu voice agents, add text-to-speech to WhatsApp bots, or transcribe call center audio.

[Documentation](https://docs.upliftai.org) · [Voices](https://docs.upliftai.org/orator_voices) · [API Reference](https://docs.upliftai.org/sdk/nodejs/overview)

## Install

```bash
npm install @upliftai/sdk-js
```

## Quick start

Generate speech and save to a file:

```ts
import { writeFileSync } from "node:fs";
import { UpliftAI } from "@upliftai/sdk-js";

const client = new UpliftAI({
  apiKey: "sk_...", // or defaults to process.env.UPLIFTAI_API_KEY
});

const { audio } = await client.tts.create({
  text: "السلام علیکم، میں آپ کی کیا مدد کر سکتا ہوں؟", // "Hello, how can I help you?"
  voiceId: "v_meklc281",
});

writeFileSync("hello.wav", audio);
```

### Options

| Option | Default | Description |
|---|---|---|
| `apiKey` | `process.env.UPLIFTAI_API_KEY` | API key |
| `timeout` | `30000` | Request timeout (ms) |
| `maxRetries` | `2` | Retries on 429 and 5xx |

```ts
const client = new UpliftAI({ apiKey: "sk_...", timeout: 60_000 });
```

## Text-to-speech

### Generate audio

Returns the full audio buffer. Best for batch/offline use.

```ts
import { writeFileSync } from "node:fs";

const { audio, metadata } = await client.tts.create({
  text: "آج موسم بہت اچھا ہے", // "The weather is great today"
  voiceId: "v_meklc281",
  outputFormat: "MP3_22050_128", // optional, defaults to WAV_22050_32
});

writeFileSync("output.mp3", audio);
console.log(metadata.contentType); // "audio/mp3"
```

### Stream audio

Returns a `Readable` stream. First chunk arrives quickly — use for real-time playback. Uses http streaming.

```ts
const { stream, metadata } = await client.tts.createStream({
  text: "اردو میں ایک لمبا جملہ", // "A long sentence in Urdu"
  voiceId: "v_meklc281",
  outputFormat: "MP3_22050_64",
});

for await (const chunk of stream) {
  process.stdout.write(chunk); // or pipe to speaker/file
}
```

### Async jobs

Enqueue a job and retrieve audio later. Returns a `temporaryUrl` you can pass directly to a frontend, WhatsApp, or `<audio>` element — no auth required.

```ts
const { mediaId, temporaryUrl } = await client.tts.enqueue({
  text: "بعد میں حاصل کریں", // "Retrieve later"
  voiceId: "v_meklc281",
});

// Option 1: retrieve server-side
const { stream } = await client.tts.retrieve(mediaId);

// Option 2: pass URL directly to client — no auth needed
console.log(temporaryUrl);
// https://api.upliftai.org/v1/synthesis/stream-audio/media_abc?token=eyJ...
```

### WebSocket (real-time)

Persistent connection for low-latency streaming. Use one connection per conversation/user session. Defaults to `PCM_22050_16` output format.

```ts
const ws = await client.tts.connect();

// 1. Stream a sentence
const s1 = ws.stream({ text: "پہلا جملہ۔", voiceId: "v_meklc281" }); // "First sentence."
for await (const event of s1) {
  if (event.type === "audio") speaker.write(event.audio);
}

// 2. User interrupts — cancel everything
ws.cancelAll(); // or cancel a specific stream with s1.cancel()

// 3. Start a new stream on the same connection
const s2 = ws.stream({ text: "نیا جواب۔", voiceId: "v_meklc281" }); // "New response."
for await (const event of s2) {
  if (event.type === "audio") speaker.write(event.audio);
}

ws.close();
```

Events: `audio_start`, `audio`, `audio_end`, `error`.

#### Real-time voice agent (pseudocode)

For conversational AI, break your LLM output into sentences and stream each one as it arrives. This gives the lowest time-to-first-audio since synthesis starts before the LLM finishes generating. If you use [LiveKit](https://livekit.io), the UpliftAI plugin handles this automatically.

```ts
const ws = await client.tts.connect();

// LLM streams tokens → your tokenizer emits complete sentences
for await (const sentence of tokenizeSentences(llmStream)) {
  const stream = ws.stream({ text: sentence, voiceId: "v_meklc281" });

  for await (const event of stream) {
    if (event.type === "audio") player.write(event.audio);
  }
}

// User interrupts mid-response
ws.cancelAll(); // stops all in-flight audio immediately

ws.close();
```

We will be building a context aware stremaing solution in the future, so you don't have to worry about tokenization and sentence breaking. Stay tuned!

### Phrase replacements

Control pronunciation of specific words and phrases. Perfect for handling:

- **Brand names** — convert English spellings to Urdu phonetics
- **Technical terms** — ensure consistent pronunciation
- **LLM outputs** — fix common misspellings from AI models
- **Regional variations** — adapt to local dialects

```ts
const config = await client.tts.phraseReplacements.create({
  phraseReplacements: [
    { phrase: "Meezan bank", replacement: "میزان بینک" }, // English brand name → Urdu pronunciation
  ],
});

await client.tts.create({
  text: "ہماری API بہت تیز ہے", // "Our API is very fast"
  voiceId: "v_meklc281",
  phraseReplacementConfigId: config.configId,
});
```

[Read more about phrase replacements](https://docs.upliftai.org/orator#phrase-replacement-for-perfect-pronunciation)

## Speech-to-text

Accepts a file path, `Buffer`, or readable stream. Pass `fileName` with Buffer/stream inputs so the server can detect the audio format.

```ts
// From file path
const { transcript } = await client.stt.transcribe({
  file: "./recording.mp3",
  model: "scribe",
});

// From buffer
const { transcript } = await client.stt.transcribe({
  file: audioBuffer,
  fileName: "recording.mp3",
  model: "scribe",
  language: "ur",
});
```

| Model | Description |
|---|---|
| `scribe` | Higher accuracy, recommended for most use cases |
| `scribe-mini` | Faster, lower cost |

## Error handling

All errors include a `requestId` for debugging with UpliftAI support.

```ts
import {
  UpliftAIError,
  UpliftAIAuthError,                // 401
  UpliftAIInsufficientBalanceError,  // 402
  UpliftAIRateLimitError,            // 429
} from "@upliftai/sdk-js";

try {
  await client.tts.create({ text: "...", voiceId: "..." });
} catch (err) {
  if (err instanceof UpliftAIRateLimitError) {
    // back off and retry
  }
  if (err instanceof UpliftAIError) {
    console.log(err.statusCode, err.requestId);
  }
}
```

## Output formats

| Format | Use case |
|---|---|
| `WAV_22050_32` | General purpose (default) |
| `WAV_22050_16` | General purpose, smaller files |
| `MP3_22050_128` | Web playback, high quality |
| `MP3_22050_64` | Web playback, balanced |
| `MP3_22050_32` | Web playback, low bandwidth |
| `PCM_22050_16` | Real-time streaming, WebSocket default |
| `OGG_22050_16` | Web playback, open format, streaming not support at this time |
| `ULAW_8000_8` | Telephony (SIP, PSTN) |

## Requirements

Node.js >= 18 · TypeScript types included · ESM and CommonJS supported

## License

MIT
