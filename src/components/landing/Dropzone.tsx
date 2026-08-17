"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { transcribeFileLocally } from "@/lib/browserTranscribe";
import { getDailyUsageCount, incrementDailyUsage, DAILY_LIMIT } from "@/lib/usageTracker";

type Mode = "upload" | "link";

export const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "Auto Detect (99+ Languages)", flag: "🌐" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "hi", name: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { code: "es", name: "Spanish (Español)", flag: "🇪🇸" },
  { code: "fr", name: "French (Français)", flag: "🇫🇷" },
  { code: "de", name: "German (Deutsch)", flag: "🇩🇪" },
  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "zh", name: "Chinese (中文)", flag: "🇨🇳" },
  { code: "ko", name: "Korean (한국어)", flag: "🇰🇷" },
  { code: "pt", name: "Portuguese (Português)", flag: "🇧🇷" },
  { code: "it", name: "Italian (Italiano)", flag: "🇮🇹" },
  { code: "ru", name: "Russian (Русский)", flag: "🇷🇺" },
  { code: "ar", name: "Arabic (العربية)", flag: "🇸🇦" },
  { code: "tr", name: "Turkish (Türkçe)", flag: "🇹🇷" },
  { code: "nl", name: "Dutch (Nederlands)", flag: "🇳🇱" },
  { code: "id", name: "Indonesian (Bahasa)", flag: "🇮🇩" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)", flag: "🇻🇳" },
  { code: "pl", name: "Polish (Polski)", flag: "🇵🇱" },
  { code: "uk", name: "Ukrainian (Українська)", flag: "🇺🇦" },
  { code: "bn", name: "Bengali (বাংলা)", flag: "🇮🇳" },
  { code: "ta", name: "Tamil (தமிழ்)", flag: "🇮🇳" },
  { code: "te", name: "Telugu (తెలుగు)", flag: "🇮🇳" },
  { code: "mr", name: "Marathi (मराठी)", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati (ગુજરાતી)", flag: "🇮🇳" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ)", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam (മലയാളം)", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ)", flag: "🇮🇳" },
  { code: "ur", name: "Urdu (اردو)", flag: "🇵🇰" },
];

const ACCEPTED_TYPES: Record<string, string[]> = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-m4a": [".m4a"],
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dropzone() {
  const [mode, setMode] = useState<Mode>("upload");
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Processing file…");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    setDailyCount(getDailyUsageCount());
  }, []);

  const isLimitReached = dailyCount >= DAILY_LIMIT;

  const startTranscription = useCallback(
    async (file: File | null, link: string | null, language: string) => {
      if (isLimitReached) return;
      setError(null);
      setUploading(true);

      // ── FILE TRANSCRIPTION ──
      if (file) {
        try {
          setStatusText("Transcribing speech with Whisper AI…");

          // 1. High-accuracy server-side transcription with Whisper Large v3
          const formData = new FormData();
          formData.append("file", file);
          formData.append("language", language);

          const res = await fetch("/api/transcribe-file", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const updatedCount = incrementDailyUsage();
            setDailyCount(updatedCount);
            router.push(`/transcript/${data.jobId}`);
            return;
          }

          const errorData = await res.json().catch(() => ({}));
          console.warn("Server transcription fallback to local engine:", errorData);

          // 2. Multilingual browser transcription fallback
          setStatusText("Transcribing locally on your device…");
          const result = await transcribeFileLocally(
            file,
            (msg) => setStatusText(msg),
            language
          );

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

          if (!saveRes.ok) throw new Error(errorData.error || "Failed to save transcript to database");

          const updatedCount = incrementDailyUsage();
          setDailyCount(updatedCount);

          const { jobId } = await saveRes.json();
          router.push(`/transcript/${jobId}`);
        } catch (err: unknown) {
          setError(
            err instanceof Error ? err.message : "Something went wrong during transcription. Please try again."
          );
          setUploading(false);
        }
      }

      // ── LINK TRANSCRIPTION ──
      else if (link) {
        try {
          setStatusText("Fetching and analyzing link audio…");
          const res = await fetch("/api/transcribe-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: link, language }),
          });
          const data = await res.json();
          if (res.ok && data.jobId) {
            const updatedCount = incrementDailyUsage();
            setDailyCount(updatedCount);
            router.push(`/transcript/${data.jobId}`);
            return;
          }

          throw new Error(data.error || "Could not process link");
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Something went wrong processing link.");
          setUploading(false);
        }
      }
    },
    [router, isLimitReached]
  );

  const onFileAccepted = useCallback((file: File) => {
    setError(null);
    setSelectedFile(file);
    setSelectedLink(null);
  }, []);

  const onLinkSubmit = useCallback(() => {
    if (!linkInput.trim()) return;
    setError(null);
    setSelectedLink(linkInput.trim());
    setSelectedFile(null);
  }, [linkInput]);

  const resetSelection = () => {
    setSelectedFile(null);
    setSelectedLink(null);
    setUploading(false);
    setError(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    multiple: false,
    disabled: uploading || isLimitReached,
    onDropAccepted: ([file]) => onFileAccepted(file),
    onDropRejected: () => setError("Please upload an mp4, mov, mp3, wav, or m4a file."),
  });

  const hasMediaSelected = Boolean(selectedFile || selectedLink);

  return (
    <div id="hero-dropzone" className="flex flex-col items-center max-w-[640px] mx-auto w-full px-4">
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
          {/* STEP 2: Language Selection & Confirmation Card (Shown AFTER upload/link) */}
          {hasMediaSelected ? (
            <div className="w-full bg-white border-2 border-ink rounded-[24px] p-6 sm:p-8 shadow-[6px_6px_0_#171717] animate-in fade-in zoom-in-95 duration-200">
              {!uploading ? (
                <>
                  {/* Selected Media Header */}
                  <div className="flex items-start justify-between gap-4 border-b-2 border-gray-100 pb-5 mb-6">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-12 h-12 rounded-[14px] bg-indigo/10 border-2 border-indigo flex items-center justify-center text-2xl shrink-0">
                        {selectedFile ? (selectedFile.type.startsWith("video") ? "🎬" : "🎵") : "🔗"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-pt-narrow font-bold text-[17px] text-ink truncate">
                          {selectedFile ? selectedFile.name : selectedLink}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] font-bold font-pt-narrow text-indigo bg-indigo/10 px-2 py-0.5 rounded-[6px]">
                            {selectedFile ? formatFileSize(selectedFile.size) : "Online Media Link"}
                          </span>
                          <span className="text-[12px] text-text-gray font-pt-narrow">Ready to transcribe</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-text-gray hover:text-ink font-bold font-pt-narrow text-[13px] underline hover:no-underline shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  {/* Language Selection Step */}
                  <div className="mb-6">
                    <label
                      htmlFor="modal-language-select"
                      className="block font-pt-narrow font-bold text-[16px] text-ink mb-1.5"
                    >
                      🗣️ What language is spoken in this audio?
                    </label>
                    <p className="font-pt-narrow text-[13px] text-text-gray mb-3">
                      Select specific language for 99%+ speech accuracy, or keep Auto Detect.
                    </p>

                    <div className="relative">
                      <select
                        id="modal-language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full border-2 border-ink bg-white rounded-[14px] py-3.5 pl-4 pr-10 font-pt-narrow font-bold text-[16px] text-ink shadow-[3px_3px_0_#171717] outline-none cursor-pointer hover:bg-gray-50 transition-colors appearance-none"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink">
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => startTranscription(selectedFile, selectedLink, selectedLanguage)}
                      className="btn-neo flex-1 justify-center py-3.5 text-[18px] bg-indigo text-white border-ink hover:bg-indigo/90 cursor-pointer shadow-[4px_4px_0_#171717]"
                    >
                      ⚡ Transcribe with AI
                    </button>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="btn-neo-white py-3.5 px-6 font-pt-narrow font-bold text-[16px] text-ink border-ink justify-center hover:bg-gray-50 cursor-pointer shadow-[3px_3px_0_#171717]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* Progress state */
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mb-4" />
                  <div className="text-[19px] font-bold text-ink font-pt-narrow mb-1">
                    {statusText}
                  </div>
                  <p className="text-[14px] text-text-gray font-pt-narrow">
                    Transcribing in{" "}
                    <span className="font-bold text-ink">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "selected language"}
                    </span>{" "}
                    with Whisper AI…
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* STEP 1: Hero Dropzone (Clean Initial State) */
            <>
              {/* Mode toggle */}
              <div className="mode-toggle mb-3">
                <button
                  id="mode-upload-btn"
                  className={`mode-toggle-btn ${mode === "upload" ? "active" : ""}`}
                  onClick={() => setMode("upload")}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v12" />
                    <path d="M7 8l5-5 5 5" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                  upload file
                </button>
                <button
                  id="mode-link-btn"
                  className={`mode-toggle-btn ${mode === "link" ? "active" : ""}`}
                  onClick={() => setMode("link")}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.41a5 5 0 0 0-7.07-7.07L10 6" />
                    <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18" />
                  </svg>
                  paste link
                </button>
              </div>

              {/* Upload mode */}
              {mode === "upload" && (
                <div
                  {...getRootProps()}
                  className={`dropzone-dashed w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 relative ${
                    isDragActive ? "bg-indigo/5 border-indigo" : ""
                  }`}
                >
                  <input {...getInputProps()} id="file-input" />
                  <div className="flex flex-col items-center justify-center text-center w-full">
                    <div className="text-indigo mb-3 flex items-center justify-center">
                      <svg
                        className="w-[38px] h-[38px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="text-[16px] text-ink mb-4 font-bold">
                      {isDragActive ? "drop it!" : "drop your video or audio here, or"}
                    </div>
                    <button
                      id="browse-file-btn"
                      type="button"
                      className="btn-neo-white pointer-events-none"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                        <path d="M12 18v-5M9.5 15.5L12 13l2.5 2.5" />
                      </svg>
                      browse file
                    </button>
                    <div className="text-[13px] text-text-gray-2 mt-[14px]">
                      mp4, mov, mp3, wav, m4a up to 500MB
                    </div>

                    {/* Decorative badges */}
                    <div
                      className="absolute left-[14px] -bottom-4 border-2 border-indigo text-indigo rounded-[6px] px-[6px] py-[2px] font-body font-extrabold text-[12px] bg-bg font-pixel select-none"
                      style={{ fontFamily: "var(--font-vt323)" }}
                    >
                      CC
                    </div>
                    <div className="absolute right-5 -bottom-[18px] text-green select-none">
                      <svg
                        className="w-[26px] h-[26px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Link mode */}
              {mode === "link" && (
                <div className="dropzone-dashed w-full flex flex-col items-center gap-4">
                  <div className="text-indigo">
                    <svg
                      className="w-[34px] h-[34px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onLinkSubmit()}
                      className="flex-1 border-2 border-ink rounded-[10px] px-4 py-3 text-[15px] font-body bg-white outline-none focus:border-indigo transition-colors"
                    />
                    <button
                      id="link-submit-btn"
                      onClick={onLinkSubmit}
                      disabled={!linkInput.trim()}
                      className="btn-neo disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      go
                    </button>
                  </div>
                  <p className="text-[13px] text-text-gray-2">
                    supports YouTube videos, Shorts, and Instagram Reels
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl max-w-md text-center">
          <p className="text-sm text-red-600 font-medium leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={resetSelection}
            className="btn-neo mt-3 text-xs px-4 py-2 bg-white"
          >
            📂 Try Again
          </button>
        </div>
      )}
    </div>
  );
}
