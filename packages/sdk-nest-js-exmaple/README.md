# UpliftAI SDK Demo

A Next.js app that demonstrates the [`@upliftai/sdk-js`](https://www.npmjs.com/package/@upliftai/sdk-js) SDK. This is a fun project to show usage examples — the code is AI-generated and is not an embodiment of best practices.

## Pages

- **TTS** — Basic text-to-speech
- **Streaming TTS** — Chunked audio streaming with progress
- **WebSocket TTS** — Persistent connection with first-chunk latency
- **Speech-to-Text** — File upload transcription
- **Phrase Replacements** — Pronunciation control
- **Live Radio** — Two AI hosts discuss topics in Urdu (OpenAI + WebSocket TTS)

## Setup

```bash
cp .env.local.example .env.local
# Add your API keys to .env.local

pnpm install
pnpm dev
```
