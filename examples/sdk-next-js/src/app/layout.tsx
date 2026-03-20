import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UpliftAI SDK Demo",
  description: "Interactive demos for @upliftai/sdk-js — TTS, STT, and real-time audio streaming",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
            <Link href="/" className="text-lg font-semibold tracking-tight shrink-0">
              UpliftAI <span className="text-muted-foreground font-normal text-sm">SDK Demo</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
