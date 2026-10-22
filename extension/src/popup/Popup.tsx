import React, { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { UploadTab } from "./components/UploadTab";
import { LinkTab } from "./components/LinkTab";
import { LanguageSelect } from "./components/LanguageSelect";
import { ProgressBar } from "./components/ProgressBar";
import { TranscriptView } from "./components/TranscriptView";
import { decodeAudioToArray } from "../lib/audioDecoder";
import { parseInputUrl, fetchYouTubeTranscriptClient } from "../lib/linkResolver";
import { TranscribeMode, TranscriptionResult, TranscribeProgress } from "../lib/types";
import { ExtensionMessage } from "../lib/messages";
import { UploadCloud, Link2, Sparkles, AlertCircle } from "lucide-react";

export const Popup: React.FC = () => {
  const [mode, setMode] = useState<TranscribeMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [language, setLanguage] = useState("auto");

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<TranscribeProgress | undefined>();
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore state on mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        ["is_transcribing", "latest_transcript", "last_error"],
        (data) => {
          if (data.is_transcribing) {
            setIsTranscribing(true);
          } else if (data.latest_transcript) {
            setResult(data.latest_transcript);
          }
          if (data.last_error) {
            setError(data.last_error);
          }
        }
      );

      // Listen for updates from offscreen / background
      const messageListener = (msg: ExtensionMessage) => {
        if (msg.type === "TRANSCRIBE_PROGRESS") {
          setIsTranscribing(true);
          setProgress(msg.progress);
        } else if (msg.type === "TRANSCRIBE_COMPLETE") {
          setIsTranscribing(false);
          setProgress(undefined);
          setResult(msg.result);
          setError(null);
        } else if (msg.type === "TRANSCRIBE_ERROR") {
          setIsTranscribing(false);
          setProgress(undefined);
          setError(msg.error);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, []);

  const handleStartTranscribe = async () => {
    setError(null);

    // ── 1. Uploaded File Transcription ──
    if (mode === "upload") {
      if (!selectedFile) {
        setError("Please choose or drag an audio/video file first.");
        return;
      }

      try {
        setIsTranscribing(true);
        setProgress({ status: "Decoding audio from file…", progress: 10 });

        const arrayBuffer = await selectedFile.arrayBuffer();
        const float32Data = await decodeAudioToArray(arrayBuffer);

        setProgress({ status: "Starting local Whisper model…", progress: 25 });

        // Dispatch to background / offscreen if in extension, or preview fallback
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: "START_TRANSCRIBE",
            audioData: Array.from(float32Data),
            sampleRate: 16000,
            language,
            fileName: selectedFile.name,
          });
        } else {
          // Preview mode fallback
          setProgress({ status: "Loading Whisper AI on-device…", progress: 35, isModelLoading: true });
          setTimeout(() => {
            setProgress({ status: "Transcribing audio segments…", progress: 75, isModelLoading: false });
            setTimeout(() => {
              const demoResult: TranscriptionResult = {
                text: "Welcome to Scribe.txt. This audio was processed 100% on-device using WebAssembly and WebAudio with zero API keys and zero server costs.",
                segments: [
                  { start: 0, end: 4, text: "Welcome to Scribe.txt." },
                  { start: 4, end: 10, text: "This audio was processed 100% on-device using WebAssembly and WebAudio." },
                  { start: 10, end: 15, text: "Zero API keys and zero server costs." },
                ],
                fileName: selectedFile.name,
                duration: 15,
                timestamp: Date.now(),
              };
              setIsTranscribing(false);
              setProgress(undefined);
              setResult(demoResult);
            }, 1000);
          }, 1000);
        }
      } catch (err: unknown) {
        console.error("Audio decoding error:", err);
        setError(err instanceof Error ? err.message : "Failed to decode audio from file.");
        setIsTranscribing(false);
        setProgress(undefined);
      }
    }

    // ── 2. Link Transcription ──
    else if (mode === "link") {
      if (!linkUrl.trim()) {
        setError("Please paste a media URL or click 'Use Current Tab URL'.");
        return;
      }

      try {
        setIsTranscribing(true);
        setProgress({ status: "Resolving link…", progress: 15 });

        const info = parseInputUrl(linkUrl);

        // YouTube: Attempt client-side instant caption fetch
        if (info.platform === "youtube" && info.id) {
          setProgress({ status: "Extracting YouTube transcripts…", progress: 40 });
          const ytResult = await fetchYouTubeTranscriptClient(info.id, language);

          if (ytResult) {
            setResult(ytResult);
            setIsTranscribing(false);
            setProgress(undefined);
            await chrome.storage.local.set({ latest_transcript: ytResult });
            return;
          }
        }

        // Direct media URL
        if (info.platform === "direct_media" || info.url.startsWith("http")) {
          setProgress({ status: "Fetching media audio stream…", progress: 30 });
          const res = await fetch(info.url);
          if (!res.ok) throw new Error("Could not download audio stream from URL.");

          const arrayBuffer = await res.arrayBuffer();
          const float32Data = await decodeAudioToArray(arrayBuffer);

          chrome.runtime.sendMessage({
            type: "START_TRANSCRIBE",
            audioData: Array.from(float32Data),
            sampleRate: 16000,
            language,
            fileName: info.url.split("/").pop() || "Web Media",
          });
          return;
        }

        throw new Error("Unable to extract audio from this URL. Try downloading the file and uploading directly.");
      } catch (err: unknown) {
        console.error("Link transcription error:", err);
        setError(err instanceof Error ? err.message : "Could not process media link.");
        setIsTranscribing(false);
        setProgress(undefined);
      }
    }
  };

  const handleReset = async () => {
    setSelectedFile(null);
    setLinkUrl("");
    setResult(null);
    setError(null);
    setIsTranscribing(false);
    setProgress(undefined);
    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.remove(["latest_transcript", "last_error", "is_transcribing"]);
    }
  };

  const canTranscribe = !isTranscribing && (mode === "upload" ? !!selectedFile : !!linkUrl.trim());

  return (
    <div className="p-4 flex flex-col min-h-[520px] max-w-[420px] mx-auto select-none">
      <Header onReset={handleReset} showReset={!!result || !!selectedFile || !!linkUrl} />

      {/* Main Content Area */}
      {result ? (
        <TranscriptView result={result} onNew={handleReset} />
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-btn-gray p-1 border-2 border-ink rounded-lg shadow-neo-sm">
            <button
              onClick={() => {
                setMode("upload");
                setError(null);
              }}
              disabled={isTranscribing}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-bold text-xs transition-all ${
                mode === "upload"
                  ? "bg-white text-ink border border-ink shadow-sm"
                  : "text-text-gray hover:text-ink"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Files
            </button>

            <button
              onClick={() => {
                setMode("link");
                setError(null);
              }}
              disabled={isTranscribing}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-bold text-xs transition-all ${
                mode === "link"
                  ? "bg-white text-ink border border-ink shadow-sm"
                  : "text-text-gray hover:text-ink"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Paste Links
            </button>
          </div>

          {/* Active Tab Component */}
          {mode === "upload" ? (
            <UploadTab
              selectedFile={selectedFile}
              onFileSelect={(file) => {
                setSelectedFile(file);
                setError(null);
              }}
              onError={(msg) => setError(msg)}
              disabled={isTranscribing}
            />
          ) : (
            <LinkTab
              url={linkUrl}
              onUrlChange={(url) => {
                setLinkUrl(url);
                setError(null);
              }}
              disabled={isTranscribing}
            />
          )}

          {/* Language Selector */}
          <LanguageSelect
            value={language}
            onChange={setLanguage}
            disabled={isTranscribing}
          />

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-xs font-semibold shadow-neo-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 leading-tight">{error}</div>
            </div>
          )}

          {/* Progress Indicator */}
          {isTranscribing && <ProgressBar progress={progress} />}

          {/* Primary Action Button */}
          <button
            onClick={handleStartTranscribe}
            disabled={!canTranscribe}
            className="btn-neo-primary w-full py-3 mt-1 text-sm font-black tracking-wide"
          >
            <Sparkles className="w-4 h-4" />
            {isTranscribing ? "Transcribing on-device…" : "Transcribe with Local AI"}
          </button>
        </div>
      )}
    </div>
  );
};
