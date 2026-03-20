import { NextResponse } from "next/server";
import { getOrCreateWs } from "../ws-pool";

// GET /api/tts/websocket/connect
// Opens (or reuses) a persistent WebSocket connection to UpliftAI.
// Returns connection info so the frontend knows when it's safe to send.
export async function GET() {
  const startMs = performance.now();

  try {
    const ws = await getOrCreateWs();
    const connectMs = Math.round(performance.now() - startMs);
    return NextResponse.json({
      status: "connected",
      sessionId: ws.sessionId,
      readyState: ws.readyState,
      connectMs,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: String(err) },
      { status: 500 },
    );
  }
}
