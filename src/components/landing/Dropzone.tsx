"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { transcribeFileLocally } from "@/lib/browserTranscribe";
import { getDailyUsageCount, incrementDailyUsage, DAILY_LIMIT } from "@/lib/usageTracker";

type Mode = "upload" | "link";

const ACCEPTED_TYPES: Record<string, string[]> = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-m4a": [".m4a"],
};

export default function Dropzone() {
  const [mode, setMode] = useState<Mode>("upload");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Processing file…");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    setDailyCount(getDailyUsageCount());
  }, []);

  const isLimitReached = dailyCount >= DAILY_LIMIT;

  const handleFile = useCallback(async (file: File) => {
    if (isLimitReached) return;
    setError(null);
    setUploading(true);

    try {
      // 1. Transcribe audio track
      const result = await transcribeFileLocally(file, (msg) => setStatusText(msg));
      
      setStatusText("Saving transcript…");
      const saveRes = await fetch("/api/jobs/save-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          text: result.text,
          segments: result.segments,
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save transcript to database");
      
      // Increment daily usage count
      const updatedCount = incrementDailyUsage();
      setDailyCount(updatedCount);

      const { jobId } = await saveRes.json();
      router.push(`/transcript/${jobId}`);
    } catch (localErr) {
      console.warn("Local audio decode failed, falling back to server pipeline:", localErr);
      setStatusText("Optimizing & processing via server pipeline…");

      try {
        const urlRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type || "video/mp4" }),
        });
        if (!urlRes.ok) throw new Error("Failed to prepare file upload.");
        const { uploadUrl, publicUrl } = await urlRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Storage upload failed (HTTP ${xhr.status}).`));
          });
          xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.send(file);
        });

        const jobRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileUrl: publicUrl, sourceType: "upload" }),
        });
        if (!jobRes.ok) throw new Error("Failed to create job.");
        
        // Increment daily usage count
        const updatedCount = incrementDailyUsage();
        setDailyCount(updatedCount);

        const { jobId } = await jobRes.json();
        router.push(`/jobs/${jobId}`);
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : "Something went wrong during file upload.");
        setUploading(false);
      }
    }
  }, [router, isLimitReached]);

  const handleLink = useCallback(async () => {
    if (!link.trim() || isLimitReached) return;
    setError(null);
    setUploading(true);
    const cleanUrl = link.trim();

    try {
      // 1. YouTube links: try native captions first for instant speed
      const isYoutube = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(cleanUrl);
      if (isYoutube) {
        setStatusText("Fetching YouTube transcript…");
        const res = await fetch("/api/transcribe-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: cleanUrl }),
        });
        const data = await res.json();
        if (res.ok && data.jobId) {
          const updatedCount = incrementDailyUsage();
          setDailyCount(updatedCount);
          router.push(`/transcript/${data.jobId}`);
          return;
        }
      }

      // 2. Download media file from link & transcribe
      const { downloadLinkAsFile } = await import("@/lib/linkDownloader");
      const file = await downloadLinkAsFile(cleanUrl, (msg) => setStatusText(msg));

      setStatusText("Transcribing your media…");
      const result = await transcribeFileLocally(file, (msg) => setStatusText(msg));

      setStatusText("Saving transcript…");
      const saveRes = await fetch("/api/jobs/save-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          text: result.text,
          segments: result.segments,
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save transcript.");

      // Increment daily usage count
      const updatedCount = incrementDailyUsage();
      setDailyCount(updatedCount);

      const { jobId } = await saveRes.json();
      router.push(`/transcript/${jobId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong processing link.");
      setUploading(false);
    }
  }, [link, router, isLimitReached]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    multiple: false,
    disabled: uploading || isLimitReached,
    onDropAccepted: ([file]) => handleFile(file),
    onDropRejected: () => setError("Please upload an mp4, mov, mp3, wav, or m4a file."),
  });

  return (
    <div id="hero-dropzone" className="flex flex-col items-center max-w-[620px] mx-auto w-full px-4">
      {/* When Daily Limit (7) is reached */}
      {isLimitReached ? (
        <div className="border-2 border-ink rounded-[20px] p-8 bg-white text-center shadow-[5px_5px_0_#171717] w-full my-2">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="font-pt-narrow font-bold text-[26px] text-ink mb-2">
            You&apos;ve used all 7 free transcripts for today!
          </h3>
          <p className="font-pt-narrow text-[18px] text-text-gray mb-6 leading-relaxed max-w-[45ch] mx-auto">
            Come back tomorrow for 7 more free transcripts, or upgrade to Pro for unlimited daily transcriptions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                const el = document.getElementById("pricing");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-neo text-[17px] font-pt-narrow font-bold py-3 px-6 bg-[#FFE500]"
            >
              ⚡ Upgrade to Pro (Unlimited)
            </button>
            <div className="border-2 border-ink rounded-[12px] px-4 py-3 text-[15px] font-pt-narrow font-bold text-indigo bg-indigo/5 flex items-center justify-center">
              ⏰ Resets at Midnight
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="mode-toggle mb-3">
            <button
              id="mode-upload-btn"
              className={`mode-toggle-btn ${mode === "upload" ? "active" : ""}`}
              onClick={() => setMode("upload")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              upload file
            </button>
            <button
              id="mode-link-btn"
              className={`mode-toggle-btn ${mode === "link" ? "active" : ""}`}
              onClick={() => setMode("link")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.41a5 5 0 0 0-7.07-7.07L10 6" /><path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18" />
              </svg>
              paste link
            </button>
          </div>

          {/* Upload mode */}
          {mode === "upload" && (
            <div
              {...getRootProps()}
              className={`dropzone-dashed w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 ${
                isDragActive ? "bg-indigo/5 border-indigo" : ""
              } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} id="file-input" />
              {!uploading ? (
                <div className="flex flex-col items-center justify-center text-center w-full">
                  <div className="text-indigo mb-3 flex items-center justify-center">
                    <svg className="w-[38px] h-[38px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="text-[16px] text-ink mb-4 font-bold">
                    {isDragActive ? "drop it!" : "drop your video here, or"}
                  </div>
                  <button
                    id="browse-file-btn"
                    type="button"
                    className="btn-neo-white pointer-events-none"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-5M9.5 15.5L12 13l2.5 2.5" />
                    </svg>
                    browse file
                  </button>
                  <div className="text-[13px] text-text-gray-2 mt-[14px]">
                    mp4, mov, mp3, wav, m4a up to 500MB
                  </div>

                  {/* Decorative badges */}
                  <div
                    className="absolute left-[14px] -bottom-4 border-2 border-indigo text-indigo rounded-[6px] px-[6px] py-[2px] font-body font-extrabold text-[12px] bg-bg font-pixel"
                    style={{ fontFamily: "var(--font-vt323)" }}
                  >
                    CC
                  </div>
                  <div className="absolute right-5 -bottom-[18px] text-green">
                    <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                </div>
              ) : (
                /* Progress state */
                <div className="flex flex-col items-center gap-4">
                  <div className="w-[34px] h-[34px] border-2 border-green border-t-transparent rounded-full animate-spin" />
                  <div className="text-[15px] font-medium text-ink font-pt-narrow">
                    {statusText}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link mode */}
          {mode === "link" && (
            <div className="dropzone-dashed w-full flex flex-col items-center gap-4">
              {!uploading ? (
                <>
                  <div className="text-indigo">
                    <svg className="w-[34px] h-[34px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.41a5 5 0 0 0-7.07-7.07L10 6" />
                      <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18" />
                    </svg>
                  </div>
                  <p className="text-[16px] text-ink font-bold">paste YouTube or Instagram link</p>
                  <div className="flex w-full max-w-[460px] gap-2">
                    <input
                      id="link-input"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... or Instagram Reel"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLink()}
                      className="flex-1 border-2 border-ink rounded-[10px] px-4 py-3 text-[15px] font-body bg-white outline-none focus:border-indigo transition-colors"
                      disabled={uploading}
                    />
                    <button
                      id="link-submit-btn"
                      onClick={handleLink}
                      disabled={uploading || !link.trim()}
                      className="btn-neo disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      go
                    </button>
                  </div>
                  <p className="text-[13px] text-text-gray-2">
                    supports YouTube videos, Shorts, and Instagram Reels
                  </p>
                </>
              ) : (
                /* Progress state */
                <div className="flex flex-col items-center gap-4">
                  <div className="w-[34px] h-[34px] border-2 border-green border-t-transparent rounded-full animate-spin" />
                  <div className="text-[15px] font-medium text-ink font-pt-narrow">
                    {statusText}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl max-w-md text-center">
          <p className="text-sm text-red-600 font-medium leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setError(null);
            }}
            className="btn-neo mt-3 text-xs px-4 py-2 bg-white"
          >
            📂 Switch to File Upload
          </button>
        </div>
      )}
    </div>
  );
}
