"use client";

import { useState, useRef } from "react";

export default function STTPage() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<"scribe" | "scribe-mini">("scribe");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function transcribe() {
    if (!file) return;

    setLoading(true);
    setTranscript(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", model);

      const res = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setTranscript(data.transcript);
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Speech-to-Text</h1>
      <p className="text-muted-foreground mb-8">
        Transcribe audio using <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">client.stt.transcribe()</code>. Upload an audio file and get the Urdu transcript.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">
                Drop an audio file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports MP3, WAV, OGG, and other audio formats
              </p>
            </div>
          )}
        </div>

        {/* Model selector */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Model
          </label>
          <div className="flex gap-3">
            {(["scribe", "scribe-mini"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  model === m
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
                <span className="block text-xs text-muted-foreground">
                  {m === "scribe" ? "Higher accuracy" : "Faster, lower cost"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={transcribe}
          disabled={loading || !file}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Transcribing..." : "Transcribe"}
        </button>

        {/* Result */}
        {transcript !== null && (
          <div className="p-4 rounded-lg bg-muted">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Transcript
            </label>
            <p dir="rtl" className="text-lg leading-relaxed">
              {transcript}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
