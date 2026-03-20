"use client";

import { useState, useRef } from "react";
import { DEFAULT_VOICE_ID } from "@/lib/constants";
import { TTSForm } from "@/components/TTSForm";

export default function StreamingTTSPage() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [outputFormat, setOutputFormat] = useState("MP3_22050_128");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ firstChunkMs: number; totalMs: number; totalBytes: number; chunkCount: number } | null>(null);
  const [liveStats, setLiveStats] = useState<{ chunks: number; bytes: number; firstChunkMs: number | null } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function streamAudio() {
    setLoading(true);
    setAudioUrl(null);
    setStats(null);
    setLiveStats({ chunks: 0, bytes: 0, firstChunkMs: null });

    const startTime = performance.now();
    let firstChunkTime: number | null = null;

    try {
      const res = await fetch("/api/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, outputFormat }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (firstChunkTime === null) {
          firstChunkTime = performance.now() - startTime;
        }
        chunks.push(value);
        totalBytes += value.length;
        chunkCount++;

        setLiveStats({
          chunks: chunkCount,
          bytes: totalBytes,
          firstChunkMs: firstChunkTime ? Math.round(firstChunkTime) : null,
        });
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: res.headers.get("Content-Type") || "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setLiveStats(null);
      setStats({
        firstChunkMs: Math.round(firstChunkTime ?? 0),
        totalMs: Math.round(performance.now() - startTime),
        totalBytes,
        chunkCount,
      });

      setTimeout(() => audioRef.current?.play(), 50);
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Streaming TTS</h1>
      <p className="text-muted-foreground mb-8">
        Stream audio chunks using <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">client.tts.createStream()</code>. First chunk arrives quickly — ideal for real-time playback.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        <TTSForm
          text={text}
          onTextChange={setText}
          voiceId={voiceId}
          onVoiceIdChange={setVoiceId}
          outputFormat={outputFormat}
          onOutputFormatChange={setOutputFormat}
          onSubmit={streamAudio}
          loading={loading}
          submitLabel="Stream Audio"
        />

        {/* Live streaming progress */}
        {liveStats && (
          <div className="mt-5 p-4 rounded-lg border border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
              </span>
              <span className="text-sm font-medium">Streaming...</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold font-mono text-accent">{liveStats.chunks}</div>
                <div className="text-xs text-muted-foreground">chunks</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{(liveStats.bytes / 1024).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">KB received</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-accent">
                  {liveStats.firstChunkMs !== null ? `${liveStats.firstChunkMs}ms` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">first chunk</div>
              </div>
            </div>
          </div>
        )}

        {audioUrl && (
          <audio ref={audioRef} controls className="w-full mt-5">
            <source src={audioUrl} />
          </audio>
        )}

        {stats && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold font-mono text-accent">{stats.firstChunkMs}ms</div>
                <div className="text-xs text-muted-foreground">first chunk</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{stats.totalMs}ms</div>
                <div className="text-xs text-muted-foreground">total time</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{stats.chunkCount}</div>
                <div className="text-xs text-muted-foreground">chunks</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{(stats.totalBytes / 1024).toFixed(1)} KB</div>
                <div className="text-xs text-muted-foreground">total size</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
