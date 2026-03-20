"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DEFAULT_VOICE_ID, SAMPLE_TEXTS } from "@/lib/constants";

type ConnectionStatus = "connecting" | "connected" | "error";

interface Message {
  id: number;
  text: string;
  status: "streaming" | "done" | "error";
  audioUrl?: string;
  error?: string;
  firstChunkMs?: number;
  serverFirstChunkMs?: number;
  totalMs?: number;
  serverTotalMs?: number;
  totalChunks?: number;
}

export default function WebSocketTTSPage() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("connecting");
  const [connMs, setConnMs] = useState<number | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(async () => {
    setConnStatus("connecting");
    setConnMs(undefined);
    try {
      const res = await fetch("/api/tts/websocket/connect");
      if (!res.ok) throw new Error("Connection failed");
      const data = await res.json();
      setConnStatus("connected");
      setConnMs(data.connectMs);
    } catch {
      setConnStatus("error");
    }
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function update(id: number, patch: Partial<Message>) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

  async function sendMessage() {
    if (!text.trim() || sending || connStatus !== "connected") return;

    const id = Date.now();
    setMessages((prev) => [...prev, { id, text, status: "streaming" as const }]);
    setText("");
    setSending(true);

    const sendTime = performance.now();

    try {
      const res = await fetch("/api/tts/websocket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const audioChunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "audio") {
            if (data.chunkIndex === 0) {
              update(id, {
                firstChunkMs: Math.round(performance.now() - sendTime),
                serverFirstChunkMs: data.serverFirstChunkMs,
              });
            }
            const bytes = Uint8Array.from(atob(data.chunk), (c) =>
              c.charCodeAt(0)
            );
            audioChunks.push(bytes);
          } else if (data.type === "done") {
            const blob = new Blob(audioChunks as BlobPart[], {
              type: "audio/mpeg",
            });
            const url = URL.createObjectURL(blob);
            update(id, {
              status: "done",
              audioUrl: url,
              totalMs: Math.round(performance.now() - sendTime),
              serverTotalMs: data.serverTotalMs,
              totalChunks: data.totalChunks,
            });
          } else if (data.type === "error") {
            update(id, { status: "error", error: data.message });
          }
        }
      }
    } catch (err) {
      update(id, { status: "error", error: String(err) });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    connStatus === "connected" && !sending && text.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">WebSocket TTS</h1>
      <p className="text-muted-foreground mb-8">
        Low-latency streaming via{" "}
        <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">
          client.tts.connect()
        </code>
        . The WebSocket connects on page load and is reused across messages.
        First-chunk latency is measured from Send.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        {/* Connection status bar */}
        <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          {connStatus === "connecting" && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              <span className="text-xs text-yellow-400">
                Connecting to WebSocket...
              </span>
            </>
          )}
          {connStatus === "connected" && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-green-400">
                WebSocket connected — ready to send
                {connMs != null && (
                  <span className="text-muted-foreground ml-1">
                    ({connMs}ms)
                  </span>
                )}
              </span>
            </>
          )}
          {connStatus === "error" && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-xs text-red-400">Connection failed</span>
              <button
                onClick={connect}
                className="text-xs text-primary hover:underline ml-2"
              >
                Retry
              </button>
            </>
          )}
        </div>

        {/* Message history */}
        <div
          ref={scrollRef}
          className="space-y-3 mb-6 max-h-96 overflow-y-auto"
        >
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              Send a message to generate speech via WebSocket
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="p-4 rounded-lg border border-border bg-muted/50"
            >
              <p dir="rtl" className="text-sm mb-3">
                {msg.text}
              </p>

              {msg.status === "streaming" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                    <span className="text-xs text-accent animate-pulse">
                      Streaming audio...
                    </span>
                  </div>
                  {msg.firstChunkMs != null && (
                    <div className="text-xs font-mono text-muted-foreground">
                      First chunk:{" "}
                      <span className="text-accent font-semibold">
                        {msg.firstChunkMs}ms
                      </span>
                      {msg.serverFirstChunkMs != null && (
                        <span className="text-muted-foreground ml-2">
                          (server: {msg.serverFirstChunkMs}ms)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {msg.status === "done" && msg.audioUrl && (
                <div className="space-y-3">
                  <audio controls className="w-full h-8">
                    <source src={msg.audioUrl} type="audio/mpeg" />
                  </audio>
                  <div className="grid grid-cols-2 gap-3">
                    {msg.firstChunkMs != null && (
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">
                          First Chunk
                        </div>
                        <div className="text-sm font-mono font-semibold text-accent">
                          {msg.firstChunkMs}ms
                        </div>
                        {msg.serverFirstChunkMs != null && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            server: {msg.serverFirstChunkMs}ms
                          </div>
                        )}
                      </div>
                    )}
                    {msg.totalMs != null && (
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">
                          Total
                        </div>
                        <div className="text-sm font-mono font-semibold text-primary">
                          {msg.totalMs}ms
                        </div>
                        {msg.serverTotalMs != null && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            server: {msg.serverTotalMs}ms
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.totalChunks != null && (
                    <div className="text-xs font-mono text-muted-foreground text-center">
                      {msg.totalChunks} chunks streamed
                    </div>
                  )}
                </div>
              )}

              {msg.status === "error" && (
                <span className="text-xs text-destructive">{msg.error}</span>
              )}
            </div>
          ))}
        </div>

        {/* Sample texts */}
        <div className="flex gap-2 flex-wrap mb-3">
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => setText(sample.text)}
              disabled={connStatus !== "connected"}
              className="px-3 py-1 text-xs rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSend && sendMessage()}
            dir="auto"
            disabled={connStatus !== "connected" || sending}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            placeholder="اردو متن یہاں لکھیں..."
          />
          <input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={connStatus !== "connected" || sending}
            className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            placeholder="Voice ID"
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
