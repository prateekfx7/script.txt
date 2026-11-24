"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { getDailyUsageCount, incrementDailyUsage, DAILY_LIMIT } from "@/lib/usageTracker";
import { useAuth } from "@/lib/useAuth";
import { parseMediaLink } from "@/lib/linkMediaService";
import { transcribeFileLocally } from "@/lib/browserTranscribe";
import { extractUrls } from "@/lib/urlUtils";
import { toCombinedTxt, toCombinedSrt, Segment } from "@/lib/export";

type Mode = "upload" | "link";
type Engine = "openai" | "local";

export interface BatchItem {
  id: string;
  url: string;
  platform: string;
  displayName: string;
  status: "pending" | "processing" | "done" | "error";
  jobId?: string;
  text?: string;
  segments?: Segment[];
  error?: string;
}

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function safeCopy(text: string) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
}

function fallbackCopy(text: string) {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  } catch {}
}

export default function Dropzone() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [mode, setMode] = useState<Mode>("upload");

  const isSubscriber = user?.user_metadata?.subscription?.status === "active";
  const engine: Engine = isSubscriber ? "openai" : "local";

  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Transcribing audio…");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);

  // Batch / On-page transcription states
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);

  // Cancellation ref
  const cancelRef = useRef(false);

  // Copy feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const detectedUrls = extractUrls(linkInput);

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

  // Single-file transcription (Cloud or Local On-Device)
  const startFileTranscription = useCallback(
    async (file: File) => {
      if (isLimitReached) return;
      setError(null);
      setUploading(true);

      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      let transcribedViaCloud = false;

      if (isSubscriber) {
        try {
          setStatusText("Transcribing with Cloud Whisper AI…");
          const formData = new FormData();
          formData.append("file", file);
          formData.append("language", selectedLanguage);

          const res = await fetch("/api/transcribe-file", {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });

          if (res.ok) {
            transcribedViaCloud = true;
            const data = await res.json();
            incrementDailyUsage();
            setDailyCount(getDailyUsageCount());
            router.push(`/transcript/${data.jobId}`);
            return;
          }
        } catch (cloudErr) {
          console.warn("Cloud transcription fallback:", cloudErr);
        }
      }

      // On-Device Local Whisper AI
      if (!transcribedViaCloud) {
        try {
          setStatusText("Transcribing on-device with Whisper AI…");
          const localResult = await transcribeFileLocally(
            file,
            (msg) => setStatusText(msg),
            selectedLanguage
          );

          setStatusText("Saving transcript…");
          const saveRes = await fetch("/api/jobs/save-local", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              fileName: file.name,
              text: localResult.text,
              segments: localResult.segments,
              language: selectedLanguage !== "auto" ? selectedLanguage : null,
              engine: "local",
            }),
          });

          if (saveRes.ok) {
            const data = await saveRes.json();
            incrementDailyUsage();
            setDailyCount(getDailyUsageCount());
            router.push(`/transcript/${data.jobId}`);
            return;
          }

          const errorData = await saveRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save transcript.");
        } catch (localErr: unknown) {
          console.error("Transcription error:", localErr);
          setError(
            localErr instanceof Error
              ? localErr.message
              : "Something went wrong during transcription. Please try again."
          );
          setUploading(false);
        }
      }
    },
    [router, isLimitReached, isSubscriber, session, selectedLanguage]
  );

  // Multi-link / In-Place Batch Execution Loop
  const startBatchTranscription = useCallback(
    async (queueToRun?: BatchItem[]) => {
      const initial = queueToRun || batchQueue;
      if (initial.length === 0) return;

      cancelRef.current = false;
      setBatchRunning(true);
      setError(null);

      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      for (let i = 0; i < initial.length; i++) {
        if (cancelRef.current) break;
        if (initial[i].status === "done") continue;

        setBatchCurrentIndex(i);
        setBatchQueue((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "processing", error: undefined } : it))
        );

        const currentItem = initial[i];

        try {
          const res = await fetch("/api/transcribe-link", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ url: currentItem.url, language: selectedLanguage }),
          });

          const data = await res.json();

          if (cancelRef.current) break;

          if (res.ok && data.jobId) {
            let text = data.text;
            let segments = data.segments;

            if (!text) {
              try {
                const jobRes = await fetch(`/api/jobs/${data.jobId}`);
                if (jobRes.ok) {
                  const jobData = await jobRes.json();
                  text = jobData.transcript?.text;
                  segments = jobData.transcript?.segments;
                }
              } catch {}
            }

            const cleanDisplayName =
              data.fileName &&
              !data.fileName.toLowerCase().includes("instagram reel") &&
              !data.fileName.toLowerCase().includes("online media")
                ? data.fileName
                : currentItem.displayName;

            setBatchQueue((prev) =>
              prev.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: "done",
                      jobId: data.jobId,
                      text,
                      segments,
                      displayName: cleanDisplayName,
                    }
                  : it
              )
            );
            incrementDailyUsage();
            setDailyCount(getDailyUsageCount());
            continue;
          }

          if (res.ok && data.requiresClientTranscribe && data.streamUrl) {
            const mediaRes = await fetch(data.streamUrl);
            if (!mediaRes.ok) throw new Error("Could not download audio stream from link.");
            const blob = await mediaRes.blob();
            const mediaFile = new File([blob], data.fileName || "web_media.mp3", {
              type: blob.type || "audio/mpeg",
            });

            const localResult = await transcribeFileLocally(
              mediaFile,
              () => {},
              selectedLanguage
            );

            if (cancelRef.current) break;

            const saveRes = await fetch("/api/jobs/save-local", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({
                fileName: data.fileName || currentItem.displayName,
                text: localResult.text,
                segments: localResult.segments,
                language: selectedLanguage !== "auto" ? selectedLanguage : null,
                engine: "local",
              }),
            });

            if (saveRes.ok) {
              const saveDat = await saveRes.json();
              setBatchQueue((prev) =>
                prev.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        status: "done",
                        jobId: saveDat.jobId,
                        text: localResult.text,
                        segments: localResult.segments,
                        displayName: data.fileName || currentItem.displayName,
                      }
                    : it
                )
              );
              incrementDailyUsage();
              setDailyCount(getDailyUsageCount());
              continue;
            }
          }

          throw new Error(data.error || "Failed to transcribe link.");
        } catch (err: unknown) {
          if (cancelRef.current) break;
          const errMessage = err instanceof Error ? err.message : "Error transcribing link.";
          setBatchQueue((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: "error",
                    error: errMessage,
                  }
                : it
            )
          );
        }
      }

      setBatchRunning(false);
    },
    [batchQueue, selectedLanguage, session]
  );

  // Single item retry
  const retryItem = async (id: string) => {
    const item = batchQueue.find((it) => it.id === id);
    if (!item) return;

    setBatchQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "processing", error: undefined } : it))
    );

    const authHeaders: Record<string, string> = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    try {
      const res = await fetch("/api/transcribe-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: item.url, language: selectedLanguage }),
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        let text = data.text;
        let segments = data.segments;
        if (!text) {
          const jobRes = await fetch(`/api/jobs/${data.jobId}`);
          if (jobRes.ok) {
            const jobData = await jobRes.json();
            text = jobData.transcript?.text;
            segments = jobData.transcript?.segments;
          }
        }
        const cleanDisplayName =
          data.fileName &&
          !data.fileName.toLowerCase().includes("instagram reel") &&
          !data.fileName.toLowerCase().includes("online media")
            ? data.fileName
            : item.displayName;

        setBatchQueue((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: "done",
                  jobId: data.jobId,
                  text,
                  segments,
                  displayName: cleanDisplayName,
                }
              : it
          )
        );
        incrementDailyUsage();
        setDailyCount(getDailyUsageCount());
        return;
      }
      throw new Error(data.error || "Failed to transcribe link.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error transcribing link.";
      setBatchQueue((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "error", error: msg } : it))
      );
    }
  };

  const handleCopyReel = (id: string, text: string) => {
    if (!text) return;
    safeCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const completed = batchQueue.filter((item) => item.status === "done" && item.text);
    if (completed.length === 0) return;
    const combined = completed
      .map((item, idx) => `=== #${idx + 1}. ${item.displayName || "Reel"} ===\n${item.text}\n`)
      .join("\n");
    safeCopy(combined);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadAllTxt = () => {
    const completed = batchQueue.filter((item) => item.status === "done" && item.text);
    if (completed.length === 0) return;
    const txtContent = toCombinedTxt(
      completed.map((item) => ({
        title: item.displayName || item.url,
        text: item.text || "",
      }))
    );
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scribe_transcripts_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllSrt = () => {
    const completed = batchQueue.filter(
      (item) => item.status === "done" && item.segments && item.segments.length > 0
    );
    if (completed.length === 0) return;
    const srtContent = toCombinedSrt(
      completed.map((item) => ({
        title: item.displayName || item.url,
        segments: item.segments || [],
      }))
    );
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scribe_subtitles_${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileAccepted = useCallback((file: File) => {
    setError(null);
    setSelectedFile(file);
    setIsBatchMode(false);
    setBatchQueue([]);
  }, []);

  // ALL links (1 or many) transcribe IN-PLACE on this page with side copy button
  const onLinkSubmit = useCallback(() => {
    const urls = extractUrls(linkInput);
    if (urls.length === 0) return;
    setError(null);

    const items: BatchItem[] = urls.map((url, idx) => {
      const info = parseMediaLink(url);
      let platformLabel = "Reel";
      if (info.platform === "youtube") platformLabel = "YouTube";
      else if (info.platform === "instagram") platformLabel = "Instagram Reel";

      let shortPath = url;
      try {
        const u = new URL(url);
        shortPath = u.hostname.replace("www.", "") + u.pathname;
        if (shortPath.length > 36) shortPath = shortPath.slice(0, 33) + "…";
      } catch {}

      return {
        id: `item-${idx}-${Date.now()}`,
        url,
        platform: info.platform,
        displayName: `${platformLabel} (${shortPath})`,
        status: "pending",
      };
    });

    setBatchQueue(items);
    setIsBatchMode(true);
    setSelectedFile(null);
    startBatchTranscription(items);
  }, [linkInput, startBatchTranscription]);

  const resetSelection = () => {
    cancelRef.current = true;
    setSelectedFile(null);
    setUploading(false);
    setError(null);
    setIsBatchMode(false);
    setBatchQueue([]);
    setBatchRunning(false);
    setBatchCurrentIndex(0);
    setCopiedId(null);
    setCopiedAll(false);
    setLinkInput("");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    multiple: false,
    disabled: uploading || isLimitReached,
    onDropAccepted: ([file]) => onFileAccepted(file),
    onDropRejected: () => setError("Please upload an mp4, mov, mp3, wav, or m4a file."),
  });

  const hasMediaSelected = Boolean(selectedFile || (isBatchMode && batchQueue.length > 0));

  const completedBatchCount = batchQueue.filter((item) => item.status === "done").length;
  const progressPercent =
    batchQueue.length > 0
      ? Math.round(
          ((completedBatchCount + batchQueue.filter((item) => item.status === "error").length) /
            batchQueue.length) *
            100
        )
      : 0;

  return (
    <div
      id="hero-dropzone"
      className={`flex flex-col items-center mx-auto w-full px-3 font-pt-narrow transition-all duration-200 ${
        isBatchMode && batchQueue.length > 0 ? "max-w-[760px]" : "max-w-[560px]"
      }`}
    >
      {/* ── STEP 2: ON-PAGE TRANSCRIPTS OR FILE VIEW ── */}
      {hasMediaSelected ? (
        <div className="w-full bg-white border border-ink/20 rounded-[20px] p-4 sm:p-6 shadow-sm animate-in fade-in duration-150 font-pt-narrow">
          {isBatchMode && batchQueue.length > 0 ? (
            <div>
              {/* Minimal Top Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[18px] text-ink">Transcripts</h3>
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-indigo/10 text-indigo">
                    {completedBatchCount}/{batchQueue.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {completedBatchCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyAll}
                        className={`px-3 py-1 text-[13px] font-bold rounded-[8px] transition-all border cursor-pointer ${
                          copiedAll
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white hover:bg-gray-50 text-ink border-ink/20"
                        }`}
                      >
                        {copiedAll ? "✓ Copied All" : "Copy All"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadAllTxt}
                        className="px-2.5 py-1 text-[12.5px] font-bold rounded-[8px] bg-white hover:bg-gray-50 text-ink border border-ink/20 transition-all cursor-pointer"
                        title="Download .txt"
                      >
                        .TXT
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadAllSrt}
                        className="px-2.5 py-1 text-[12.5px] font-bold rounded-[8px] bg-white hover:bg-gray-50 text-ink border border-ink/20 transition-all cursor-pointer"
                        title="Download .srt"
                      >
                        .SRT
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="px-2.5 py-1 text-[12.5px] font-bold text-text-gray hover:text-ink hover:underline cursor-pointer"
                  >
                    + New
                  </button>
                </div>
              </div>

              {/* Slim Progress Bar */}
              {batchRunning && (
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3.5">
                  <div
                    className="bg-indigo h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Reel Card Sections with Side Copy Button */}
              <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
                {batchQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`border rounded-[14px] p-3.5 sm:p-4 transition-all bg-white ${
                      batchRunning && batchCurrentIndex === idx
                        ? "border-indigo shadow-xs"
                        : "border-ink/15"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[12px] font-bold text-indigo bg-indigo/10 px-2 py-0.5 rounded-md shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-[15px] text-ink truncate max-w-[240px] sm:max-w-[420px]" title={item.url}>
                          {item.displayName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.jobId && (
                          <a
                            href={`/transcript/${item.jobId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] font-bold text-text-gray hover:text-ink hover:underline hidden sm:inline"
                            title="Open standalone transcript page"
                          >
                            Page ↗
                          </a>
                        )}

                        {item.status === "done" && item.text && (
                          <button
                            type="button"
                            onClick={() => handleCopyReel(item.id, item.text!)}
                            className={`px-3 py-1 text-[13px] font-bold rounded-[8px] transition-all cursor-pointer border ${
                              copiedId === item.id
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-indigo text-white hover:bg-indigo/90 border-indigo/20 active:scale-95 shadow-xs"
                            }`}
                          >
                            {copiedId === item.id ? "✓ Copied" : "Copy"}
                          </button>
                        )}

                        {item.status === "processing" && (
                          <span className="text-[12px] font-bold text-indigo px-2.5 py-0.5 rounded-full bg-indigo/10 animate-pulse">
                            Transcribing…
                          </span>
                        )}

                        {item.status === "pending" && (
                          <span className="text-[12px] text-text-gray font-medium">Queued</span>
                        )}

                        {item.status === "error" && (
                          <span className="text-[12px] font-bold text-red-600">Failed</span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    {item.status === "done" && item.text && (
                      <div className="bg-gray-50/80 border border-ink/10 rounded-[10px] p-3 sm:p-3.5 text-[14.5px] font-pt-narrow text-ink leading-relaxed whitespace-pre-wrap select-text max-h-[180px] overflow-y-auto">
                        {item.text}
                      </div>
                    )}

                    {item.status === "processing" && (
                      <div className="py-4 flex items-center justify-center gap-2.5 text-[13.5px] text-indigo font-bold bg-indigo/5 rounded-[10px]">
                        <div className="w-4 h-4 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                        <span>Transcribing with Whisper AI…</span>
                      </div>
                    )}

                    {item.status === "error" && (
                      <div className="flex items-center justify-between p-2.5 text-[13px] text-red-600 bg-red-50 rounded-[8px] mt-1">
                        <span className="truncate max-w-[340px]">{item.error || "Failed to transcribe link."}</span>
                        <button
                          type="button"
                          onClick={() => retryItem(item.id)}
                          className="ml-2 px-2.5 py-0.5 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-[6px] font-bold text-[12px] cursor-pointer shrink-0"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── SINGLE FILE UPLOAD VIEW ── */
            <div>
              {!uploading ? (
                <>
                  <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-gray-100">
                    <div className="overflow-hidden">
                      <div className="font-bold text-[15.5px] text-ink truncate max-w-[340px]">
                        {selectedFile?.name}
                      </div>
                      <div className="text-[12px] text-text-gray">
                        {selectedFile && formatFileSize(selectedFile.size)}
                        {mediaDuration !== null && ` • ${formatDuration(mediaDuration)}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-[13px] text-text-gray hover:text-ink hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {mediaPreviewUrl && (
                    <div className="mb-4 rounded-[12px] overflow-hidden bg-black/5 border border-ink/15">
                      {selectedFile?.type.startsWith("video") ? (
                        <video src={mediaPreviewUrl} controls playsInline className="w-full max-h-[180px] object-contain bg-black" />
                      ) : (
                        <div className="p-2.5 bg-gray-50">
                          <audio src={mediaPreviewUrl} controls className="w-full h-9" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => selectedFile && startFileTranscription(selectedFile)}
                      className="flex-1 py-3 bg-indigo text-white hover:bg-indigo/90 rounded-[10px] font-bold text-[16px] cursor-pointer shadow-sm transition-all active:scale-[0.99]"
                    >
                      Transcribe Now
                    </button>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-ink rounded-[10px] font-bold text-[15px] cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 border-3 border-indigo border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-[17px] font-bold text-ink mb-1">{statusText}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── STEP 1: MINIMAL DROPZONE ── */
        <>
          {/* Segmented Mode Switch */}
          <div className="inline-flex p-1 bg-gray-200/60 rounded-full mb-3 gap-1 shadow-xs">
            <button
              id="mode-upload-btn"
              className={`font-bold text-[14px] px-4 py-1.5 rounded-full cursor-pointer transition-all ${
                mode === "upload" ? "bg-white text-ink shadow-xs" : "text-text-gray hover:text-ink"
              }`}
              onClick={() => setMode("upload")}
            >
              upload file
            </button>
            <button
              id="mode-link-btn"
              className={`font-bold text-[14px] px-4 py-1.5 rounded-full cursor-pointer transition-all ${
                mode === "link" ? "bg-white text-ink shadow-xs" : "text-text-gray hover:text-ink"
              }`}
              onClick={() => setMode("link")}
            >
              paste links
            </button>
          </div>

          {/* Upload Mode */}
          {mode === "upload" && (
            <div
              {...getRootProps()}
              className={`dropzone-dashed w-full flex flex-col items-center justify-center text-center py-10 px-6 cursor-pointer transition-all ${
                isDragActive ? "bg-indigo/5 border-indigo" : ""
              }`}
            >
              <input {...getInputProps()} id="file-input" />
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                <svg className="w-5 h-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </div>
              <div className="text-[16px] text-ink font-bold mb-1">
                {isDragActive ? "drop it!" : "drop video or audio, or browse"}
              </div>
              <div className="text-[13px] text-text-gray">mp4, mov, mp3, wav, m4a up to 500MB</div>
            </div>
          )}

          {/* Link Mode (Clean, Simplified, No Overlapping) */}
          {mode === "link" && (
            <div className="dropzone-dashed w-full flex flex-col p-4 sm:p-5 gap-3 font-pt-narrow">
              <textarea
                id="link-input"
                rows={3}
                placeholder="Paste Instagram, YouTube, or media links (one or multiple)..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && detectedUrls.length > 0) {
                    onLinkSubmit();
                  }
                }}
                className="w-full border border-ink/20 focus:border-indigo rounded-[12px] p-3 text-[15px] font-pt-narrow bg-white outline-none shadow-xs transition-all font-medium placeholder:text-text-gray/50 resize-y min-h-[90px] leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2">
                <div>
                  {detectedUrls.length > 1 ? (
                    <span className="text-[13px] font-bold text-indigo px-2.5 py-0.5 rounded-full bg-indigo/10">
                      ⚡ {detectedUrls.length} links ready
                    </span>
                  ) : detectedUrls.length === 1 ? (
                    <span className="text-[13px] font-bold text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50">
                      ✓ 1 link ready
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-text-gray">Instagram Reels, YouTube, Drive, direct URLs</span>
                  )}
                </div>

                <button
                  id="link-submit-btn"
                  onClick={onLinkSubmit}
                  disabled={detectedUrls.length === 0}
                  className="bg-indigo hover:bg-indigo/90 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-[10px] font-pt-narrow font-bold text-[15px] transition-all shadow-xs border border-indigo/20 cursor-pointer shrink-0"
                >
                  {detectedUrls.length > 1
                    ? `Transcribe All (${detectedUrls.length})`
                    : "Transcribe"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mt-3 p-4 bg-yellow/15 border border-ink/20 rounded-[14px] w-full text-center shadow-xs font-pt-narrow">
          <p className="text-[14px] text-ink font-semibold mb-2">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setUploading(false);
            }}
            className="px-3 py-1 bg-white border border-ink/20 rounded-[8px] font-bold text-[13px] text-ink cursor-pointer hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
