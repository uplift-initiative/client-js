import { getClient } from "@/lib/uplift";
import type { TTSWebSocket } from "@upliftai/sdk-js";

// Module-level singleton — persists across requests within the same server process.
let ws: TTSWebSocket | null = null;
let connectPromise: Promise<TTSWebSocket> | null = null;

export async function getOrCreateWs(): Promise<TTSWebSocket> {
  if (ws && ws.readyState === "open") {
    return ws;
  }

  // If already connecting, wait for it
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const client = getClient();
    const conn = await client.tts.connect();

    conn.on("close", () => {
      ws = null;
      connectPromise = null;
    });

    conn.on("error", () => {
      ws = null;
      connectPromise = null;
    });

    ws = conn;
    connectPromise = null;
    return conn;
  })();

  return connectPromise;
}
