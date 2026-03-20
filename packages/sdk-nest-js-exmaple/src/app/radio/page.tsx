"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const VOICES = [
  { id: "v_8eelc901", label: "Info/Education", gender: "female" as const },
  { id: "v_meklc281", label: "Info/Education V2", gender: "female" as const },
  { id: "v_30s70t3a", label: "Nostalgic News", gender: "male" as const },
  { id: "v_yypgzenx", label: "Dada Jee", gender: "male" as const },
];

const FEMALE_NAMES = [
  "فاطمہ", "عائشہ", "زینب", "مریم", "سارہ",
  "نادیہ", "رابعہ", "حنا", "انعم", "صبا",
];

const MALE_NAMES = [
  "احمد", "عمران", "بلال", "حسن", "عثمان",
  "طارق", "کامران", "فیصل", "شاہد", "وقاص",
];

function pickRandom(names: string[]): string {
  return names[Math.floor(Math.random() * names.length)];
}

function pickPersonas(voice1Id: string, voice2Id: string): [string, string] {
  const v1 = VOICES.find((v) => v.id === voice1Id);
  const v2 = VOICES.find((v) => v.id === voice2Id);
  const pool1 = v1?.gender === "female" ? FEMALE_NAMES : MALE_NAMES;
  const pool2 = v2?.gender === "female" ? FEMALE_NAMES : MALE_NAMES;
  const p1 = pickRandom(pool1);
  let p2 = pickRandom(pool2);
  // Ensure unique names if both draw from same pool
  while (p2 === p1 && pool2.length > 1) {
    p2 = pickRandom(pool2);
  }
  return [p1, p2];
}

interface Turn {
  speaker: string;
  text: string;
  turnIndex: number;
  audioUrl: string;
}

export default function RadioPage() {
  const [topic, setTopic] = useState("Who was the greatest Urdu poet — Ghalib or Iqbal?");
  const [voice1, setVoice1] = useState("v_30s70t3a");
  const [voice2, setVoice2] = useState("v_8eelc901");
  const [isLive, setIsLive] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentTurn, setCurrentTurn] = useState(-1);
  const [generating, setGenerating] = useState(false);
  const [personas, setPersonas] = useState<[string, string]>(["", ""]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<Turn[]>([]);
  const isPlayingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // When voice1 changes, ensure voice2 is different
  useEffect(() => {
    if (voice1 === voice2) {
      const other = VOICES.find((v) => v.id !== voice1);
      if (other) setVoice2(other.id);
    }
  }, [voice1, voice2]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setCurrentTurn(-1);
      return;
    }

    isPlayingRef.current = true;
    const turn = audioQueueRef.current.shift()!;

    // Reveal the turn text only now — when it's about to play
    setTurns((prev) => [...prev, turn]);
    setCurrentTurn(turn.turnIndex);

    const audio = new Audio(turn.audioUrl);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(turn.audioUrl);
      setCurrentTurn(-1);
      playNextInQueue();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(turn.audioUrl);
      setCurrentTurn(-1);
      playNextInQueue();
    };
    audio.play().catch(() => playNextInQueue());
  }, []);

  function enqueueTurn(turn: Turn) {
    audioQueueRef.current.push(turn);
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }

  async function startRadio() {
    if (!topic.trim()) return;

    const [p1, p2] = pickPersonas(voice1, voice2);
    setPersonas([p1, p2]);

    setIsLive(true);
    setGenerating(true);
    setTurns([]);
    setCurrentTurn(-1);
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/radio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          voice1,
          voice2,
          persona1: p1,
          persona2: p2,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setIsLive(false);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "turn") {
            const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            enqueueTurn({
              speaker: data.speaker,
              text: data.text,
              turnIndex: data.turnIndex,
              audioUrl: url,
            });
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Radio error:", err);
      }
    } finally {
      setGenerating(false);
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        setIsLive(false);
      }
    }
  }

  function stopRadio() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setCurrentTurn(-1);
    setIsLive(false);
    setGenerating(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Live Radio</h1>
      <p className="text-muted-foreground mb-8">
        Two AI hosts discuss any topic in Urdu — powered by OpenAI +{" "}
        <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">
          client.tts.connect()
        </code>
        . Enter a topic, pick two voices, and go live.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Discussion Topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              dir="auto"
              rows={2}
              disabled={isLive}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
              placeholder="e.g. What's the best way to make biryani?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Speaker 1
              </label>
              <select
                value={voice1}
                onChange={(e) => setVoice1(e.target.value)}
                disabled={isLive}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === voice2 || undefined}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Speaker 2
              </label>
              <select
                value={voice2}
                onChange={(e) => setVoice2(e.target.value)}
                disabled={isLive}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === voice1 || undefined}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            {!isLive ? (
              <button
                onClick={startRadio}
                disabled={!topic.trim() || voice1 === voice2}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                Go Live
              </button>
            ) : (
              <button
                onClick={stopRadio}
                className="px-5 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/80 transition-colors"
              >
                Stop
              </button>
            )}
            {isLive && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                ON AIR
                {personas[0] && (
                  <span className="text-xs">
                    — {personas[0]} &amp; {personas[1]}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="space-y-3 max-h-[28rem] overflow-y-auto"
        >
          {turns.length === 0 && !isLive && (
            <p className="text-muted-foreground text-sm text-center py-12">
              Enter a topic and go live to start the radio show
            </p>
          )}
          {turns.length === 0 && isLive && (
            <p className="text-muted-foreground text-sm text-center py-12 animate-pulse">
              {generating ? "Getting the team on air..." : "Warming up the mics..."}
            </p>
          )}
          {turns.map((turn) => {
            const isSpeaker1 = turn.speaker === personas[0];
            const isActive = currentTurn === turn.turnIndex;

            return (
              <div
                key={turn.turnIndex}
                className={`p-4 rounded-lg border transition-all ${
                  isActive
                    ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(109,40,217,0.15)]"
                    : "border-border bg-muted/30"
                } ${isSpeaker1 ? "" : "ml-8"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isSpeaker1
                        ? "bg-primary/20 text-primary"
                        : "bg-accent/20 text-accent"
                    }`}
                  >
                    {turn.speaker}
                  </span>
                  {isActive && (
                    <span className="flex gap-0.5 items-end h-3">
                      <span className="w-0.5 bg-primary rounded-full animate-pulse h-1" style={{ animationDelay: "0ms" }} />
                      <span className="w-0.5 bg-primary rounded-full animate-pulse h-2" style={{ animationDelay: "150ms" }} />
                      <span className="w-0.5 bg-primary rounded-full animate-pulse h-3" style={{ animationDelay: "300ms" }} />
                      <span className="w-0.5 bg-primary rounded-full animate-pulse h-2" style={{ animationDelay: "450ms" }} />
                      <span className="w-0.5 bg-primary rounded-full animate-pulse h-1" style={{ animationDelay: "600ms" }} />
                    </span>
                  )}
                </div>
                <p dir="rtl" className="text-sm leading-relaxed">
                  {turn.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
