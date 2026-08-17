import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — scribe.txt",
  description: "Get in touch with Prateek Maurya — the maker of scribe.txt.",
};

const CONTACT_LINKS = [
  {
    label: "Email",
    value: "prateekmaurya862@gmail.com",
    href: "mailto:prateekmaurya862@gmail.com",
    desc: "fastest way to reach me",
    icon: "✉",
  },
  {
    label: "Twitter / X",
    value: "@prateekmaurya77",
    href: "https://twitter.com/prateekmaurya77",
    desc: "dm's are open",
    icon: "✦",
  },
  {
    label: "Instagram",
    value: "@prateek.fx",
    href: "https://instagram.com/prateek.fx",
    desc: "for the visual stuff",
    icon: "◆",
  },
  {
    label: "LinkedIn",
    value: "prateekfx",
    href: "https://www.linkedin.com/in/prateekfx/",
    desc: "let's connect professionally",
    icon: "▦",
  },
  {
    label: "GitHub",
    value: "prateekfx7",
    href: "https://github.com/prateekfx7",
    desc: "see what i'm building",
    icon: "◉",
  },
  {
    label: "Portfolio",
    value: "prateekfxportfolio.vercel.app",
    href: "https://prateekfxportfolio.vercel.app/",
    desc: "my work, all in one place",
    icon: "◈",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg font-pt-narrow">
      {/* Navbar */}
      <nav className="max-w-[1080px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="font-pixel text-[24px] text-indigo leading-none select-none hover:opacity-80 transition-opacity">
          scribe.txt
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/about" className="text-[15px] text-text-gray hover:text-ink transition-colors">About</Link>
          <Link href="/contact" className="text-[15px] font-bold text-ink">Contact</Link>
          <Link href="/" className="text-[15px] text-text-gray hover:text-ink transition-colors">← Home</Link>
        </div>
      </nav>

      <main className="max-w-[680px] mx-auto px-8 py-16">

        {/* Eyebrow */}
        <p className="eyebrow">contact</p>

        {/* Headline */}
        <h1 className="font-pt-narrow font-bold text-[40px] text-ink leading-tight mb-4">
          let's talk 💬
        </h1>
        <p className="text-[18px] text-text-gray leading-[1.7] mb-14">
          got a question, idea, collab request, or just want to say hi? my dms are open on pretty much everything.
        </p>

        {/* Contact cards */}
        <div className="flex flex-col gap-4 mb-14">
          {CONTACT_LINKS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.href.startsWith("mailto") ? undefined : "_blank"}
              rel="noreferrer"
              className="flex items-center gap-5 bg-white border-2 border-ink rounded-[14px] px-5 py-4 hover:translate-x-[2px] hover:translate-y-[2px] transition-all group"
              style={{ boxShadow: "3px 3px 0 #171717" }}
            >
              <span className="text-indigo text-[22px] w-8 flex-shrink-0 text-center">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-ink group-hover:text-indigo transition-colors">{c.label}</p>
                <p className="text-[13px] text-text-gray-2 truncate">{c.desc}</p>
              </div>
              <span className="text-[14px] font-bold text-ink font-mono hidden sm:block truncate max-w-[200px]">
                {c.value}
              </span>
              <span className="text-text-gray-2 text-[18px] flex-shrink-0">→</span>
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 mb-10" />

        {/* Footer note */}
        <p className="text-[14px] text-text-gray text-center leading-relaxed">
          i try to reply within 24 hours. if it's urgent, email is your best bet. 🙂
        </p>

        <div className="mt-10 flex justify-center">
          <Link href="/about" className="btn-neo bg-white text-ink border-ink">
            ← read about me
          </Link>
        </div>
      </main>
    </div>
  );
}
