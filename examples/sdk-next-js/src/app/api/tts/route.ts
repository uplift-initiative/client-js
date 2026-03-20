import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/uplift";
import type { OutputFormat } from "@upliftai/sdk-js";

export async function POST(request: NextRequest) {
  const { text, voiceId, outputFormat, phraseReplacementConfigId } =
    await request.json();

  const client = getClient();
  const { audio, metadata } = await client.tts.create({
    text,
    voiceId,
    outputFormat: outputFormat as OutputFormat,
    phraseReplacementConfigId,
  });

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": metadata.contentType,
      "X-Audio-Duration": String(metadata.duration),
      "X-Request-Id": metadata.requestId,
    },
  });
}
