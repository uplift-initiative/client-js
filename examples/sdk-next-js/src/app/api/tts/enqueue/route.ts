import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/uplift";
import type { OutputFormat } from "@upliftai/sdk-js";

export async function POST(request: NextRequest) {
  const { text, voiceId, outputFormat } = await request.json();

  const client = getClient();
  const result = await client.tts.enqueue({
    text,
    voiceId,
    outputFormat: outputFormat as OutputFormat,
  });

  return NextResponse.json(result);
}
