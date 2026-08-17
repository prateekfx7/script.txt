"use client";

const Sparkle = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  </svg>
);

export default function CtaBanner() {
  const scrollToHero = () => {
    document.getElementById("hero-dropzone")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="section-pad">
      <div
        className="rounded-[22px] px-10 py-[70px] text-center relative overflow-hidden text-white"
        style={{ background: "#3222DD" }}
        id="cta-banner"
      >
        {/* Deco sparkles */}
        <div className="absolute top-9 left-[8%] text-white/60 hidden sm:block"><Sparkle /></div>
        <div className="absolute bottom-9 right-[8%] text-white/60 hidden sm:block"><Sparkle /></div>

        <h2 className="font-display font-extrabold text-white mb-[14px]"
          style={{ fontSize: "clamp(28px, 4.5vw, 42px)" }}>
          stop typing it out yourself
        </h2>
        <p className="text-white/85 text-[16px] mb-[30px]">
          upload your first video and get a full transcript back in under a minute.
        </p>
        <button
          id="cta-upload-btn"
          onClick={scrollToHero}
          className="btn-neo-white"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          upload your video
        </button>
      </div>
    </section>
  );
}
