import { NextRequest } from "next/server";
import { getOrCreateWs } from "./ws-pool";

// POST /api/tts/websocket
// Reuses the persistent WebSocket, streams TTS audio chunks back via SSE.
// Includes server-side first-chunk timing.
export async function POST(request: NextRequest) {
  const { text, voiceId } = await request.json();

  if (!text || !voiceId) {
    return new Response("Missing text or voiceId", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      }

      let ws;
      try {
        ws = await getOrCreateWs();
      } catch (err) {
        send({ type: "error", message: `WebSocket connection failed: ${err}` });
        controller.close();
        return;
      }

      try {
        let chunkIndex = 0;
        const serverStartMs = performance.now();
        let serverFirstChunkMs: number | undefined;

        const ttsStream = ws.stream({
          text,
          voiceId,
          outputFormat: "MP3_22050_64",
        });

        for await (const event of ttsStream) {
          if (event.type === "audio") {
            if (chunkIndex === 0) {
              serverFirstChunkMs = Math.round(performance.now() - serverStartMs);
            }
            const base64 = event.audio.toString("base64");
            send({
              type: "audio",
              chunk: base64,
              chunkIndex,
              ...(chunkIndex === 0 && { serverFirstChunkMs }),
            });
            chunkIndex++;
          }
        }

        const serverTotalMs = Math.round(performance.now() - serverStartMs);
        send({ type: "done", totalChunks: chunkIndex, serverTotalMs });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        // Don't close ws — it's reused across requests
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
