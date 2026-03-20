"use client";

import { useState } from "react";
import { DEFAULT_VOICE_ID } from "@/lib/constants";
import { AudioPlayer } from "@/components/AudioPlayer";

interface Replacement {
  phrase: string;
  replacement: string;
}

export default function PhraseReplacementsPage() {
  const [text, setText] = useState("Meezan bank کی سروس بہت اچھی ہے");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [replacements, setReplacements] = useState<Replacement[]>([
    { phrase: "Meezan bank", replacement: "میزان بینک" },
  ]);
  const [loading, setLoading] = useState(false);
  const [withReplacementsUrl, setWithReplacementsUrl] = useState<string | null>(null);
  const [withoutReplacementsUrl, setWithoutReplacementsUrl] = useState<string | null>(null);

  function addReplacement() {
    setReplacements((prev) => [...prev, { phrase: "", replacement: "" }]);
  }

  function removeReplacement(index: number) {
    setReplacements((prev) => prev.filter((_, i) => i !== index));
  }

  function updateReplacement(
    index: number,
    field: "phrase" | "replacement",
    value: string
  ) {
    setReplacements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  async function generate() {
    setLoading(true);
    setWithReplacementsUrl(null);
    setWithoutReplacementsUrl(null);

    try {
      // Generate without replacements
      const resWithout = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId,
          outputFormat: "MP3_22050_128",
        }),
      });
      if (!resWithout.ok) throw new Error(await resWithout.text());
      const blobWithout = await resWithout.blob();
      setWithoutReplacementsUrl(URL.createObjectURL(blobWithout));

      // Generate with replacements
      const validReplacements = replacements.filter(
        (r) => r.phrase.trim() && r.replacement.trim()
      );
      if (validReplacements.length > 0) {
        const resWith = await fetch("/api/phrase-replacements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voiceId,
            outputFormat: "MP3_22050_128",
            phraseReplacements: validReplacements,
          }),
        });
        if (!resWith.ok) throw new Error(await resWith.text());
        const blobWith = await resWith.blob();
        setWithReplacementsUrl(URL.createObjectURL(blobWith));
      }
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Phrase Replacements</h1>
      <p className="text-muted-foreground mb-8">
        Control pronunciation using{" "}
        <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">
          client.tts.phraseReplacements.create()
        </code>
        . Map English brand names, technical terms, or LLM outputs to correct Urdu pronunciation.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir="auto"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Voice ID
          </label>
          <input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-64 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Replacements */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Phrase Replacements
          </label>
          <div className="space-y-2">
            {replacements.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={r.phrase}
                  onChange={(e) => updateReplacement(i, "phrase", e.target.value)}
                  placeholder="Phrase (e.g. Meezan bank)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-muted-foreground text-sm">&rarr;</span>
                <input
                  value={r.replacement}
                  onChange={(e) =>
                    updateReplacement(i, "replacement", e.target.value)
                  }
                  placeholder="Replacement (e.g. میزان بینک)"
                  dir="auto"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => removeReplacement(i)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove replacement"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addReplacement}
            className="mt-3 w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
          >
            + Add replacement
          </button>
        </div>

        <button
          onClick={generate}
          disabled={loading || !text.trim()}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Generating..." : "Compare"}
        </button>

        {/* Results side by side */}
        {(withoutReplacementsUrl || withReplacementsUrl) && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Without Replacements
              </p>
              <AudioPlayer src={withoutReplacementsUrl} />
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                With Replacements
              </p>
              <AudioPlayer src={withReplacementsUrl} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
