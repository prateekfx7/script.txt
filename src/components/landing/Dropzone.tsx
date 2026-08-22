"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { getDailyUsageCount, incrementDailyUsage, DAILY_LIMIT } from "@/lib/usageTracker";
import { useAuth } from "@/lib/useAuth";
import { parseMediaLink } from "@/lib/linkMediaService";

type Mode = "upload" | "link";
type Engine = "openai" | "local";

export const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "Auto Detect (99+ Languages)" },
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi (हिन्दी)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "zh", name: "Chinese (中文)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "tr", name: "Turkish (Türkçe)" },
  { code: "nl", name: "Dutch (Nederlands)" },
  { code: "id", name: "Indonesian (Bahasa)" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)" },
  { code: "pl", name: "Polish (Polski)" },
  { code: "uk", name: "Ukrainian (Українська)" },
  { code: "bn", name: "Bengali (বাংলা)" },
  { code: "ta", name: "Tamil (தமிழ்)" },
  { code: "te", name: "Telugu (తెలుగు)" },
  { code: "mr", name: "Marathi (मराठी)" },
  { code: "gu", name: "Gujarati (ગુજરાતી)" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ)" },
  { code: "ml", name: "Malayalam (മലയാളം)" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ur", name: "Urdu (اردو)" },
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Dropzone() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [mode, setMode] = useState<Mode>("upload");

  const isSubscriber = user?.user_metadata?.subscription?.status === "active";
  const engine: Engine = isSubscriber ? "openai" : "local";

  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Transcribing audio…");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);

  useEffect(() => {
    setDailyCount(getDailyUsageCount());
  }, [isSubscriber]);

  // Load preview URL and duration when file is selected
  useEffect(() => {
    if (!selectedFile) {
      setMediaDuration(null);
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
        setMediaPreviewUrl(null);
      }
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setMediaPreviewUrl(objectUrl);

    const isVideo = selectedFile.type.startsWith("video");
    const mediaEl = document.createElement(isVideo ? "video" : "audio");
    mediaEl.preload = "metadata";
    mediaEl.src = objectUrl;
    mediaEl.onloadedmetadata = () => {
      if (mediaEl.duration && !isNaN(mediaEl.duration) && isFinite(mediaEl.duration)) {
        setMediaDuration(mediaEl.duration);
      }
    };

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const isLimitReached = !isSubscriber && dailyCount >= DAILY_LIMIT;

  const startTranscription = useCallback(
    async (file: File | null, link: string | null, language: string, _selectedEngine: Engine) => {
      if (isLimitReached) return;
      setError(null);
      setUploading(true);

      // ── 1. FILE TRANSCRIPTION (Groq Whisper Cloud AI) ──
      if (file) {
        try {
          setStatusText("Transcribing with Whisper AI…");

          const formData = new FormData();
          formData.append("file", file);
          formData.append("language", language);

          const authHeaders: Record<string, string> = session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {};

          const res = await fetch("/api/transcribe-file", {
            method: "POST",
            headers: authHeaders,
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
          throw new Error(errorData.error || "Failed to transcribe audio file.");
        } catch (err: unknown) {
          console.error("Transcription error:", err);
          setError(
            err instanceof Error ? err.message : "Something went wrong during transcription. Please try again."
          );
          setUploading(false);
          return;
        }
      }

      // ── 2. LINK TRANSCRIPTION ──
      else if (link) {
        try {
          const authHeaders: Record<string, string> = session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {};

          setStatusText("Processing link & generating transcript…");
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
    [router, isLimitReached, isSubscriber, session]
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
  const linkInfo = selectedLink ? parseMediaLink(selectedLink) : null;

  return (
    <div id="hero-dropzone" className="flex flex-col items-center max-w-[640px] mx-auto w-full px-4 font-pt-narrow">
      {/* When Daily Limit (7) is reached */}
      {isLimitReached ? (
        <div className="border border-ink/20 rounded-[20px] p-8 bg-white text-center shadow-sm w-full my-2 font-pt-narrow">
          <h3 className="font-pt-narrow font-bold text-[26px] text-ink mb-2">
            You&apos;ve used all 7 free transcripts for today!
          </h3>
          <p className="font-pt-narrow text-[17px] text-text-gray mb-6 leading-relaxed max-w-[45ch] mx-auto font-medium">
            Come back tomorrow for 7 more free transcripts, or upgrade to Pro for unlimited daily transcriptions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                const el = document.getElementById("pricing");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-6 py-3 bg-indigo text-white hover:bg-indigo/90 font-bold text-[16px] rounded-[10px] shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Upgrade to Pro (Unlimited)
            </button>
            <div className="border border-indigo/20 rounded-[10px] px-4 py-3 text-[15px] font-pt-narrow font-bold text-indigo bg-indigo/5 flex items-center justify-center">
              Resets at Midnight
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* STEP 2: Language Selection & AI Engine Panel (Shown AFTER upload/link) */}
          {hasMediaSelected ? (
            <div className="w-full bg-white border border-ink/20 rounded-[24px] p-6 sm:p-8 shadow-sm animate-in fade-in zoom-in-95 duration-200 font-pt-narrow">
              {!uploading ? (
                <>
                  {/* Selected Media Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5 mb-5">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-12 h-12 rounded-[14px] bg-indigo/10 border border-indigo/20 flex items-center justify-center text-indigo shrink-0">
                        {linkInfo?.platform === "youtube" ? (
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        ) : linkInfo?.platform === "instagram" ? (
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                          </svg>
                        ) : linkInfo?.platform === "gdrive" ? (
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.41a5 5 0 0 0-7.07-7.07L10 6"/>
                            <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18"/>
                          </svg>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-pt-narrow font-bold text-[18px] text-ink truncate">
                          {selectedFile ? selectedFile.name : linkInfo?.displayName || selectedLink}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[13px] font-bold font-pt-narrow text-indigo bg-indigo/10 px-2.5 py-0.5 rounded-[6px]">
                            {selectedFile
                              ? formatFileSize(selectedFile.size)
                              : linkInfo?.displayName || "Online Media Link"}
                          </span>
                          {mediaDuration !== null && (
                            <span className="text-[13px] font-bold font-pt-narrow text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-[6px]">
                              {formatDuration(mediaDuration)}
                            </span>
                          )}
                          <span className="text-[13px] text-text-gray font-pt-narrow font-medium">Ready to transcribe</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-text-gray hover:text-ink font-bold font-pt-narrow text-[14px] underline hover:no-underline shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Media Preview Player (Video or Audio) */}
                  {mediaPreviewUrl && (
                    <div className="mb-5 rounded-[16px] overflow-hidden border border-ink/15 bg-black/5 shadow-sm">
                      {selectedFile?.type.startsWith("video") ? (
                        <video
                          src={mediaPreviewUrl}
                          controls
                          playsInline
                          className="w-full max-h-[220px] object-contain bg-black rounded-[14px]"
                        />
                      ) : (
                        <div className="p-3 bg-gray-50 flex flex-col items-center">
                          <audio src={mediaPreviewUrl} controls className="w-full h-10" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Minimal Language Selection Button with SF Pro Display */}
                  <div className="mb-6">
                    <label
                      htmlFor="modal-language-select"
                      className="block font-sf-pro font-medium text-[13px] text-text-gray uppercase tracking-wider mb-2"
                    >
                      Language
                    </label>

                    <div className="relative">
                      <select
                        id="modal-language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full border border-ink/15 bg-white hover:bg-gray-50/80 rounded-[12px] py-2.5 pl-3.5 pr-10 font-sf-pro font-medium text-[14.5px] text-ink shadow-sm outline-none cursor-pointer hover:border-ink/30 transition-all appearance-none"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code} className="font-sf-pro font-normal">
                            {lang.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-gray">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
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
                        startTranscription(selectedFile, selectedLink, selectedLanguage, engine)
                      }
                      className="flex-1 justify-center py-3.5 px-6 text-[17px] bg-indigo text-white hover:bg-indigo/90 cursor-pointer shadow-sm font-bold font-pt-narrow rounded-[12px] transition-all active:scale-[0.99] border border-indigo/20 flex items-center gap-2"
                    >
                      Transcribe Now
                    </button>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="py-3.5 px-6 font-pt-narrow font-bold text-[16px] text-ink bg-gray-100 hover:bg-gray-200 rounded-[12px] justify-center cursor-pointer transition-all border border-gray-200/60"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* Progress state */
                <div className="flex flex-col items-center justify-center py-8 text-center font-pt-narrow">
                  <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mb-4" />
                  <div className="text-[19px] font-bold text-ink font-pt-narrow mb-1">
                    {statusText}
                  </div>
                  <p className="text-[15px] text-text-gray font-pt-narrow font-medium">
                    Transcribing in{" "}
                    <span className="font-bold text-ink font-pt-narrow">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "selected language"}
                    </span>
                    …
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* STEP 1: Hero Dropzone (Clean Initial State) */
            <>
              {/* Minimal Segmented Mode toggle */}
              <div className="inline-flex p-1 bg-[#ECECEA]/70 border border-ink/10 rounded-full mb-3 gap-1 shadow-inner">
                <button
                  id="mode-upload-btn"
                  className={`font-pt-narrow font-bold text-[15px] px-5 py-2 rounded-full cursor-pointer flex items-center gap-1.5 transition-all ${
                    mode === "upload"
                      ? "bg-white text-ink shadow-sm font-bold"
                      : "text-text-gray hover:text-ink font-medium"
                  }`}
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
                  className={`font-pt-narrow font-bold text-[15px] px-5 py-2 rounded-full cursor-pointer flex items-center gap-1.5 transition-all ${
                    mode === "link"
                      ? "bg-white text-ink shadow-sm font-bold"
                      : "text-text-gray hover:text-ink font-medium"
                  }`}
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
                  className={`dropzone-dashed w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 relative font-pt-narrow ${
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
                    <div className="text-[17px] text-ink mb-4 font-bold font-pt-narrow">
                      {isDragActive ? "drop it!" : "drop your video or audio here, or"}
                    </div>
                    <button
                      id="browse-file-btn"
                      type="button"
                      className="bg-white hover:bg-gray-50 text-ink border border-ink/20 shadow-sm rounded-[10px] px-5 py-2.5 font-bold font-pt-narrow text-[15px] transition-all inline-flex items-center gap-2 pointer-events-none"
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
                    <div className="text-[14px] text-text-gray-2 mt-[14px] font-pt-narrow font-medium">
                      mp4, mov, mp3, wav, m4a up to 500MB
                    </div>

                    {/* Decorative badges */}
                    <div
                      className="absolute left-[14px] -bottom-4 border-2 border-indigo text-indigo rounded-[6px] px-[6px] py-[2px] font-extrabold text-[12px] bg-bg font-pixel select-none"
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
                <div className="dropzone-dashed w-full flex flex-col items-center justify-center py-10 px-6 gap-4 font-pt-narrow">
                  <div className="text-indigo mb-1 flex items-center justify-center">
                    <svg
                      className="w-[34px] h-[34px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.41a5 5 0 0 0-7.07-7.07L10 6" />
                      <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18" />
                    </svg>
                  </div>

                  <div className="w-full max-w-[480px] flex gap-2">
                    <input
                      id="link-input"
                      type="url"
                      placeholder="Paste any YouTube, Instagram, or media link..."
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onLinkSubmit()}
                      className="flex-1 border border-ink/20 rounded-[10px] px-4 py-3 text-[15.5px] font-pt-narrow bg-white outline-none focus:border-indigo shadow-sm transition-all font-medium placeholder:text-text-gray/50"
                    />
                    <button
                      id="link-submit-btn"
                      onClick={onLinkSubmit}
                      disabled={!linkInput.trim()}
                      className="bg-indigo hover:bg-indigo/90 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-[10px] font-pt-narrow font-bold text-[15.5px] transition-all shadow-sm border border-indigo/20 cursor-pointer shrink-0"
                    >
                      Transcribe
                    </button>
                  </div>

                  <div className="text-[13px] text-text-gray-2 font-pt-narrow font-medium">
                    YouTube, Instagram, Google Drive, Dropbox, or direct audio/video
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 p-5 bg-yellow/15 border border-ink/20 rounded-[18px] max-w-lg text-center shadow-sm animate-in fade-in duration-200 font-pt-narrow">
          <h4 className="font-pt-narrow font-bold text-[18px] text-ink mb-1">
            {error.toLowerCase().includes("instagram") ? "Instagram Reel" : "Notice"}
          </h4>
          <p className="text-[14.5px] text-ink/80 font-pt-narrow font-semibold leading-relaxed mb-4">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetSelection();
                setMode("upload");
              }}
              className="px-4 py-2 bg-white text-ink border border-ink/20 rounded-[10px] cursor-pointer font-bold font-pt-narrow text-[14.5px] shadow-sm hover:bg-gray-50 transition-all"
            >
              Upload Video/Audio File
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setUploading(false);
              }}
              className="px-4 py-2 bg-gray-100 text-ink border border-gray-200 rounded-[10px] cursor-pointer font-bold font-pt-narrow text-[14.5px] hover:bg-gray-200 transition-all"
            >
              Try Another Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
