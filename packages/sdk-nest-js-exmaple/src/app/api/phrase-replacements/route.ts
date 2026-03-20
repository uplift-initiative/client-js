import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/uplift";
import type { PhraseReplacement, OutputFormat } from "@upliftai/sdk-js";

export async function POST(request: NextRequest) {
  const { phraseReplacements, text, voiceId, outputFormat } =
    await request.json();

  const client = getClient();

  // Create phrase replacement config
  const config = await client.tts.phraseReplacements.create(
    phraseReplacements as PhraseReplacement[],
  );

  // Generate TTS with the config
  const { audio, metadata } = await client.tts.create({
    text,
    voiceId,
    outputFormat: outputFormat as OutputFormat,
    phraseReplacementConfigId: config.configId,
  });

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": metadata.contentType,
      "X-Config-Id": config.configId,
      "X-Request-Id": metadata.requestId,
    },
  });
}
