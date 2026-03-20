"use client";

import { useState } from "react";
import { DEFAULT_VOICE_ID } from "@/lib/constants";
import { TTSForm } from "@/components/TTSForm";
import { AudioPlayer } from "@/components/AudioPlayer";

export default function TTSPage() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [outputFormat, setOutputFormat] = useState("MP3_22050_128");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);

  async function generate() {
    setLoading(true);
    setAudioUrl(null);
    setMetadata(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, outputFormat }),
      });

      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setMetadata({
        duration: res.headers.get("X-Audio-Duration") || "—",
        requestId: res.headers.get("X-Request-Id") || "—",
        contentType: res.headers.get("Content-Type") || "—",
      });
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Text-to-Speech</h1>
      <p className="text-muted-foreground mb-8">
        Generate complete audio using <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">client.tts.create()</code>. Returns the full audio buffer — best for batch/offline use.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        <TTSForm
          text={text}
          onTextChange={setText}
          voiceId={voiceId}
          onVoiceIdChange={setVoiceId}
          outputFormat={outputFormat}
          onOutputFormatChange={setOutputFormat}
          onSubmit={generate}
          loading={loading}
          submitLabel="Generate Audio"
        />

        <AudioPlayer src={audioUrl} />

        {metadata && (
          <div className="mt-4 p-3 rounded-lg bg-muted text-xs font-mono space-y-1">
            <div>Duration: {metadata.duration}s</div>
            <div>Content-Type: {metadata.contentType}</div>
            <div>Request ID: {metadata.requestId}</div>
          </div>
        )}
      </div>
    </div>
  );
}
