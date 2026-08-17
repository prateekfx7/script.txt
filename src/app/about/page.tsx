import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — scribe.txt",
  description: "scribe.txt is an AI-powered transcription tool built by Prateek Maurya. Turn any video or audio into text in seconds.",
};

const LINKS = [
  { label: "Portfolio", href: "https://prateekfxportfolio.vercel.app/", icon: "◈" },
  { label: "GitHub",    href: "https://github.com/prateekfx7",          icon: "◉" },
  { label: "LinkedIn",  href: "https://www.linkedin.com/in/prateekfx/", icon: "▦" },
  { label: "Twitter",   href: "https://twitter.com/prateekmaurya77",    icon: "✦" },
  { label: "Instagram", href: "https://instagram.com/prateek.fx",       icon: "◆" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg font-pt-narrow">
      {/* Navbar */}
      <nav className="max-w-[1080px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="font-pixel text-[24px] text-indigo leading-none select-none hover:opacity-80 transition-opacity">
          scribe.txt
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/about" className="text-[15px] font-bold text-ink">About</Link>
          <Link href="/contact" className="text-[15px] text-text-gray hover:text-ink transition-colors">Contact</Link>
          <Link href="/" className="text-[15px] text-text-gray hover:text-ink transition-colors">← Home</Link>
        </div>
      </nav>

      <main className="max-w-[680px] mx-auto px-8 py-16">

        {/* Eyebrow */}
        <p className="eyebrow">about</p>

        {/* Headline */}
        <h1 className="font-pt-narrow font-bold text-[40px] text-ink leading-tight mb-6">
          hey, i'm prateek 👋
        </h1>

        {/* Bio block */}
        <div className="space-y-5 text-[17px] text-text-gray leading-[1.75] mb-12">
          <p>
            i'm a developer and indie maker who loves building tools that actually make people's lives easier.{" "}
            <strong className="text-ink">scribe.txt</strong> is one of those tools — drop in a video, get a clean transcript in seconds, no friction.
          </p>
          <p>
            i built this because transcription tools were either slow, ugly, or absurdly expensive. so i made my own using OpenAI's Whisper AI, Next.js, and a lot of coffee.
          </p>
          <p>
            when i'm not shipping stuff, i'm probably on instagram posting whatever or doom-scrolling github.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 mb-12" />

        {/* What is scribe.txt */}
        <h2 className="font-bold text-[22px] text-ink mb-4">what is scribe.txt?</h2>
        <div className="space-y-4 text-[16px] text-text-gray leading-[1.75] mb-12">
          <p>
            scribe.txt is an ai transcription tool that turns any video or audio into accurate text — in 40+ languages, in seconds.
          </p>
          <ul className="space-y-2 pl-4">
            {[
              "upload a file or paste a link (youtube, instagram, etc.)",
              "get a timestamped, clean transcript instantly",
              "export as txt, srt, or vtt",
              "no editing skills needed. seriously.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-indigo mt-1 flex-shrink-0">✦</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 mb-12" />

        {/* Links */}
        <h2 className="font-bold text-[22px] text-ink mb-6">find me online</h2>
        <div className="flex flex-col gap-3">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 group"
            >
              <span className="text-indigo text-[18px] w-6 flex-shrink-0">{l.icon}</span>
              <span className="text-[16px] text-ink font-bold group-hover:text-indigo transition-colors">
                {l.label}
              </span>
              <span className="text-[13px] text-text-gray-2 font-normal truncate">
                {l.href}
              </span>
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex gap-4">
          <Link href="/contact" className="btn-neo bg-indigo text-white border-ink" style={{ boxShadow: "4px 4px 0 #171717" }}>
            get in touch →
          </Link>
          <Link href="/" className="btn-neo bg-white text-ink border-ink">
            try scribe.txt
          </Link>
        </div>
      </main>
    </div>
  );
}
