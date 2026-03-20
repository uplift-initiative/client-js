import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/uplift";
import type { OutputFormat } from "@upliftai/sdk-js";

export async function POST(request: NextRequest) {
  const { text, voiceId, outputFormat } = await request.json();

  const client = getClient();
  const { stream, metadata } = await client.tts.createStream({
    text,
    voiceId,
    outputFormat: outputFormat as OutputFormat,
  });

  // Convert Node.js Readable to a web ReadableStream
  const webStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": metadata.contentType,
      "Transfer-Encoding": "chunked",
      "X-Audio-Duration": String(metadata.duration),
      "X-Request-Id": metadata.requestId,
    },
  });
}
