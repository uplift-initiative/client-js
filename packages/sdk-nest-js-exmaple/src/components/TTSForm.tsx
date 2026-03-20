"use client";

import { DEFAULT_VOICE_ID, OUTPUT_FORMATS, SAMPLE_TEXTS } from "@/lib/constants";

interface TTSFormProps {
  text: string;
  onTextChange: (text: string) => void;
  voiceId: string;
  onVoiceIdChange: (voiceId: string) => void;
  outputFormat: string;
  onOutputFormatChange: (format: string) => void;
  onSubmit: () => void;
  loading: boolean;
  submitLabel?: string;
  children?: React.ReactNode;
}

export function TTSForm({
  text,
  onTextChange,
  voiceId,
  onVoiceIdChange,
  outputFormat,
  onOutputFormatChange,
  onSubmit,
  loading,
  submitLabel = "Generate",
  children,
}: TTSFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Sample texts
        </label>
        <div className="flex gap-2 flex-wrap">
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => onTextChange(sample.text)}
              className="px-3 py-1 text-xs rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Text (Urdu)
        </label>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          dir="auto"
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="اردو متن یہاں لکھیں..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Voice ID
          </label>
          <input
            value={voiceId}
            onChange={(e) => onVoiceIdChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder={DEFAULT_VOICE_ID}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Output Format
          </label>
          <select
            value={outputFormat}
            onChange={(e) => onOutputFormatChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {OUTPUT_FORMATS.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {children}

      <button
        onClick={onSubmit}
        disabled={loading || !text.trim()}
        className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Processing..." : submitLabel}
      </button>
    </div>
  );
}
