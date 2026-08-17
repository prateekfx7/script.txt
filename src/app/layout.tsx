import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

export const metadata: Metadata = {
  title: "scribe.txt — video to text, in seconds",
  description:
    "Drop a video, get a clean, accurate transcript in seconds. AI transcription in 40+ languages. Export as TXT, SRT, or VTT.",
  keywords: ["transcription", "video to text", "audio to text", "AI transcription", "subtitle generator"],
  openGraph: {
    title: "scribe.txt — video to text, in seconds",
    description: "Drop a video, get a clean, accurate transcript in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${vt323.variable}`}>
      <body className="font-pt-narrow bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
