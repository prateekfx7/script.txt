import Image from "next/image";
import Dropzone from "./Dropzone";

const STICKERS = [
  { id: 1, src: "/stickers/sticker1.png", alt: "Sticker 1", desktopStyle: { top: "30px", left: "3%", transform: "rotate(-8deg)" }, mobileRotation: "-rotate-6" },
  { id: 2, src: "/stickers/sticker2.png", alt: "Sticker 2", desktopStyle: { top: "40px", right: "3%", transform: "rotate(6deg)" }, mobileRotation: "rotate-6" },
  { id: 3, src: "/stickers/sticker3.png", alt: "Sticker 3", desktopStyle: { top: "210px", left: "4%", transform: "rotate(-5deg)" }, mobileRotation: "-rotate-3" },
  { id: 4, src: "/stickers/sticker4.png", alt: "Sticker 4", desktopStyle: { top: "230px", right: "4%", transform: "rotate(7deg)" }, mobileRotation: "rotate-6" },
  { id: 5, src: "/stickers/sticker5.png", alt: "Sticker 5", desktopStyle: { top: "440px", left: "2%", transform: "rotate(-10deg)" }, mobileRotation: "-rotate-6" },
  { id: 6, src: "/stickers/sticker6.png", alt: "Sticker 6", desktopStyle: { top: "460px", right: "2%", transform: "rotate(9deg)" }, mobileRotation: "rotate-8" },
  { id: 7, src: "/stickers/sticker7.png", alt: "Sticker 7", desktopStyle: { top: "15px", right: "22%", transform: "rotate(-4deg)" }, mobileRotation: "-rotate-4" },
  { id: 8, src: "/stickers/sticker8.png", alt: "Sticker 8", desktopStyle: { top: "20px", left: "20%", transform: "rotate(5deg)" }, mobileRotation: "rotate-3" },
];

export default function HeroSection() {
  return (
    <section className="section-pad text-center relative pt-[40px] md:pt-[60px] overflow-hidden px-4" id="product">
      {/* Desktop / Large Screen Floating Transparent Stickers */}
      {STICKERS.map((sticker) => (
        <div
          key={`desktop-${sticker.id}`}
          className="absolute hidden md:block z-10 hover:scale-125 hover:rotate-0 hover:z-20 transition-all duration-200 cursor-pointer pointer-events-auto"
          style={sticker.desktopStyle}
        >
          <Image
            src={sticker.src}
            alt={sticker.alt}
            width={95}
            height={95}
            className="object-contain w-[85px] lg:w-[95px] h-[85px] lg:h-[95px] select-none"
            unoptimized
          />
        </div>
      ))}

      {/* Eyebrow */}
      <div
        className="font-pt-narrow font-normal text-[22px] text-indigo flex items-center justify-center gap-3 mb-[14px] relative z-10"
        style={{ fontFamily: "'PT Sans Narrow', sans-serif", fontWeight: 400 }}
      >
        ✦ video-to-text ✦
      </div>

      {/* Headline */}
      <h1
        className="font-pt-narrow font-normal text-indigo relative z-10 tracking-tight"
        style={{
          fontFamily: "'PT Sans Narrow', sans-serif",
          fontWeight: 400,
          fontSize: "clamp(36px, 6vw, 58px)",
          lineHeight: 1.03,
          letterSpacing: "-0.03em",
        }}
      >
        turn any video<br />into text, instantly
      </h1>

      {/* Subhead */}
      <p
        className="font-pt-narrow font-normal max-w-[46ch] mx-auto mt-[16px] text-text-gray text-[17.5px] leading-[1.45] relative z-10"
        style={{ letterSpacing: "-0.015em" }}
      >
        drop a video, get a clean, accurate transcript in seconds. no editing skills required.
      </p>

      {/* Mobile Sticker Bar (Displays all 8 transparent hand-drawn stickers cleanly below subhead) */}
      <div className="md:hidden flex flex-wrap items-center justify-center gap-2.5 my-5 px-2 relative z-10">
        {STICKERS.map((sticker) => (
          <div
            key={`mobile-${sticker.id}`}
            className={`transform ${sticker.mobileRotation} hover:rotate-0 hover:scale-115 transition-transform cursor-pointer`}
          >
            <Image
              src={sticker.src}
              alt={sticker.alt}
              width={48}
              height={48}
              className="object-contain w-[42px] h-[42px] select-none"
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* Dropzone (upload/link toggle + dashed zone) */}
      <div className="mt-[24px] md:mt-[34px] relative z-10">
        <Dropzone />
      </div>
    </section>
  );
}
