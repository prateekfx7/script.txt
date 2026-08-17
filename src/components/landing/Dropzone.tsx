"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { transcribeFileLocally } from "@/lib/browserTranscribe";
import { getDailyUsageCount, incrementDailyUsage, DAILY_LIMIT } from "@/lib/usageTracker";
import { useAuth } from "@/lib/useAuth";

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
  const router = useRouter();
  const { user, session } = useAuth();
  const [mode, setMode] = useState<Mode>("upload");

  const isSubscriber = user?.user_metadata?.subscription?.status === "active";
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Processing file…");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);

  useEffect(() => {
    setDailyCount(getDailyUsageCount());
  }, []);

  const isLimitReached = !isSubscriber && dailyCount >= DAILY_LIMIT;

  const startTranscription = useCallback(
    async (file: File | null, link: string | null, language: string) => {
      if (isLimitReached) return;
      setError(null);
      setUploading(true);

      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      // ── 1. FILE TRANSCRIPTION (100% Local On-Device Whisper AI) ──
      if (file) {
        try {
          setStatusText("Processing with PrateekAI Neural Whisper Engine…");
          const result = await transcribeFileLocally(file, (msg) => setStatusText(msg), language);

          setStatusText("Saving transcript…");
          const saveRes = await fetch("/api/jobs/save-local", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              fileName: file.name,
              text: result.text,
              segments: result.segments,
              language: language !== "auto" ? language : null,
              engine: "local",
            }),
          });

          if (!saveRes.ok) throw new Error("Failed to save transcript to database");
          const updatedCount = incrementDailyUsage();
          setDailyCount(updatedCount);

          const { jobId } = await saveRes.json();
          router.push(`/transcript/${jobId}`);
        } catch (localErr: unknown) {
          setError(
            localErr instanceof Error
              ? localErr.message
              : "Local transcription error. Please try another audio file."
          );
          setUploading(false);
        }
      }

      // ── 2. LINK TRANSCRIPTION ──
      else if (link) {
        try {
          setStatusText("Fetching and analyzing media audio with AI…");
          const res = await fetch("/api/transcribe-link", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
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
    [router, isLimitReached, session]
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
          {/* STEP 2: Language Selection Panel (Shown AFTER upload/link) */}
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
                          <span className="text-[12px] font-bold font-pt-narrow text-indigo bg-[#FFE500]/40 px-2 py-0.5 rounded-[6px]">
                            ⚡ PrateekAI Ultra Model v2.4
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-text-gray hover:text-ink font-bold font-pt-narrow text-[13px] underline hover:no-underline shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Language Selection Step */}
                  <div className="mb-6">
                    <label
                      htmlFor="modal-language-select"
                      className="block font-pt-narrow font-bold text-[15px] text-ink mb-1.5"
                    >
                      🗣️ Select Audio Language:
                    </label>

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
                      onClick={() =>
                        startTranscription(selectedFile, selectedLink, selectedLanguage)
                      }
                      className="btn-neo flex-1 justify-center py-3.5 text-[18px] bg-indigo text-white border-ink hover:bg-indigo/90 cursor-pointer shadow-[4px_4px_0_#171717]"
                    >
                      ⚡ Transcribe with PrateekAI Model
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
                    ⚡ Processing speech with <strong className="text-indigo">PrateekAI Ultra Neural Engine</strong>…
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
                  onClick={() => {
                    setMode("upload");
                    setError(null);
                  }}
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  upload file
                </button>
                <button
                  id="mode-link-btn"
                  className={`mode-toggle-btn ${mode === "link" ? "active" : ""}`}
                  onClick={() => {
                    setMode("link");
                    setError(null);
                  }}
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  paste link
                </button>
              </div>

              {/* Upload Mode */}
              {mode === "upload" && (
                <div
                  {...getRootProps()}
                  id="dropzone-area"
                  className={`dropzone-dashed w-full cursor-pointer transition-all duration-150 ${
                    isDragActive
                      ? "border-indigo bg-indigo/5 scale-[1.01]"
                      : "hover:border-indigo/60 hover:bg-white/60"
                  }`}
                >
                  <input {...getInputProps()} id="file-input" />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-[14px] bg-indigo/10 border-2 border-indigo flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-indigo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="font-pt-narrow font-bold text-[19px] text-ink mb-1">
                      {isDragActive ? "drop your video or audio here" : "drop video or audio here"}
                    </p>
                    <p className="text-[14px] text-text-gray mb-3 font-pt-narrow">
                      or <span className="text-indigo font-bold underline">browse files</span> from your computer
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] font-pt-narrow text-text-gray-2 bg-white/80 border border-gray-300 rounded-full px-3 py-1">
                      <span>MP4</span> · <span>MOV</span> · <span>MP3</span> · <span>WAV</span> · <span>M4A</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Link Mode */}
              {mode === "link" && (
                <div className="w-full bg-white border-2 border-ink rounded-[20px] p-5 sm:p-6 shadow-neo-sm">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="url"
                      id="link-url-input"
                      placeholder="Paste YouTube or Instagram link…"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onLinkSubmit()}
                      className="flex-1 border-2 border-ink rounded-[12px] px-4 py-3 text-[16px] font-pt-narrow outline-none focus:border-indigo transition-colors"
                    />
                    <button
                      id="submit-link-btn"
                      onClick={onLinkSubmit}
                      className="btn-neo bg-indigo text-white text-[16px] px-5 py-3"
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
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
