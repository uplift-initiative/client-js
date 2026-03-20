"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "TTS" },
  { href: "/streaming", label: "Streaming TTS" },
  { href: "/websocket", label: "WebSocket TTS" },
  { href: "/stt", label: "Speech-to-Text" },
  { href: "/phrase-replacements", label: "Phrase Replacements" },
  { href: "/radio", label: "Live Radio" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              isActive
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
