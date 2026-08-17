export default function DemoVideo() {
  return (
    <section className="section-pad">
      <div
        className="bg-ink rounded-[18px] border-2 border-ink flex flex-col items-center justify-center gap-4 cursor-pointer group"
        style={{ aspectRatio: "16 / 7.2" }}
        role="button"
        aria-label="Watch 60-second demo"
        id="demo-video-block"
      >
        <div className="w-16 h-16 rounded-full border-[2.5px] border-white flex items-center justify-center text-white transition-transform duration-150 group-hover:scale-[1.08]">
          <svg className="w-[22px] h-[22px] ml-[3px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white text-[14.5px] font-medium">watch: 60-second demo</span>
      </div>
    </section>
  );
}
