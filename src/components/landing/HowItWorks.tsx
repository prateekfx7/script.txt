const steps = [
  {
    n: "1",
    title: "upload your video or audio",
    body: "drag and drop a file or paste a link, any format works.",
  },
  {
    n: "2",
    title: "we transcribe it for you",
    body: "our ai listens closely and turns speech into clean text in seconds.",
  },
  {
    n: "3",
    title: "copy or download the transcript",
    body: "grab plain text, srt, or vtt, ready to paste or publish.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section-pad" id="how">
      <div className="section-head">
        <div className="eyebrow text-center">how to use it</div>
        <h2 className="font-display font-extrabold text-ink"
          style={{ fontSize: "clamp(28px, 4vw, 38px)", lineHeight: 1.2 }}>
          three steps, zero learning curve
        </h2>
      </div>

      <div className="max-w-[640px] mx-auto flex flex-col gap-[26px]">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-[18px] items-start">
            <div className="step-circle">{s.n}</div>
            <div>
              <h4 className="font-body text-[16.5px] font-bold mb-1">{s.title}</h4>
              <p className="text-[14.5px] text-text-gray leading-[1.55]">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
