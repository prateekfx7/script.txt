const features = [
  {
    icon: (
      <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <path d="M12 17v4M9 21h6" />
      </svg>
    ),
    title: "accurate transcription",
    body: "ai speech recognition tuned for clean, readable text with punctuation.",
  },
  {
    icon: (
      <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    ),
    title: "40+ languages",
    body: "auto-detects spoken language and transcribes without extra setup.",
  },
  {
    icon: (
      <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
    title: "timestamped output",
    body: "every line comes with timecodes, ready for captions or subtitles.",
  },
  {
    icon: (
      <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="M7 11l5 5 5-5" />
        <path d="M4 19h16" />
      </svg>
    ),
    title: "export anywhere",
    body: "download as txt, srt, or vtt, or copy straight to your clipboard.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="section-pad">
      <div className="section-head">
        <div className="eyebrow text-center">what it does</div>
        <h2 className="font-display font-extrabold text-ink"
          style={{ fontSize: "clamp(28px, 4vw, 38px)", lineHeight: 1.2 }}>
          everything you need to<br />go from video to words
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[22px]">
        {features.map((f) => (
          <div key={f.title} className="card-neo p-7">
            <div className="text-indigo mb-4">{f.icon}</div>
            <h3 className="font-body text-[17px] font-bold mb-2">{f.title}</h3>
            <p className="text-[14.5px] text-text-gray leading-[1.6]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
