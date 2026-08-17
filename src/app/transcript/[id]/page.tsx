import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import CopyButton from "@/components/ui/CopyButton";

interface Segment {
  start: number;
  end: number;
  text: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "transcript — scribe.txt",
  };
}

export default async function TranscriptPage({ params }: { params: { id: string } }) {
  const transcript = await prisma.transcript.findUnique({
    where: { jobId: params.id },
    include: { job: true },
  });

  if (!transcript || transcript.job.status !== "done") {
    notFound();
  }

  const segments = (transcript.segments as unknown) as Segment[];
  const { job } = transcript;

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <div className="wrap">
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="font-pixel text-[24px] text-indigo leading-none">
            scribe.txt
          </Link>
          <Link href="/" className="btn-neo text-sm">
            + new transcript
          </Link>
        </nav>
      </div>

      <div className="wrap pb-20">
        {/* File info header */}
        <div className="mb-8">
          <h1 className="font-display font-extrabold text-[28px] text-ink mb-1 truncate">
            {job.fileName}
          </h1>
          <p className="text-[13px] text-text-gray-2">
            transcribed ·{" "}
            {new Date(job.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <a
            id="export-txt-btn"
            href={`/api/export/${params.id}?format=txt`}
            download
            className="btn-neo text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 19h16" />
            </svg>
            download .txt
          </a>
          <a
            id="export-srt-btn"
            href={`/api/export/${params.id}?format=srt`}
            download
            className="btn-neo text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 19h16" />
            </svg>
            download .srt
          </a>
          <a
            id="export-vtt-btn"
            href={`/api/export/${params.id}?format=vtt`}
            download
            className="btn-neo text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 19h16" />
            </svg>
            download .vtt
          </a>
          <CopyButton text={transcript.text} />
        </div>

        {/* Transcript viewer card */}
        <div className="card-neo p-0 overflow-hidden">
          {/* Full text */}
          <div className="border-b-2 border-ink p-6">
            <h2 className="font-body font-bold text-[15px] mb-4 text-ink">full transcript</h2>
            <p className="text-[15px] text-ink leading-[1.75] whitespace-pre-wrap">
              {transcript.text}
            </p>
          </div>

          {/* Timestamped segments */}
          <div className="p-6">
            <h2 className="font-body font-bold text-[15px] mb-4 text-ink">
              timestamped segments
            </h2>
            <div className="flex flex-col gap-3">
              {segments.map((seg, i) => (
                <div key={i} className="flex gap-4 items-start" id={`seg-${i}`}>
                  <span className="flex-shrink-0 font-pt-narrow font-bold text-[16px] text-indigo mt-[2px] w-[72px]">
                    {formatTime(seg.start)}
                  </span>
                  <p className="text-[14.5px] text-ink leading-[1.6] flex-1">{seg.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
