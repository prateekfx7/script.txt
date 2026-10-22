import React, { useState } from "react";
import { Copy, Check, Download, Search, FileText, List, Sparkles } from "lucide-react";
import { TranscriptionResult } from "../../lib/types";
import { toTxt, toSrt, toVtt, downloadFile, copyToClipboard } from "../../lib/export";

interface TranscriptViewProps {
  result: TranscriptionResult;
  onNew: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ result, onNew }) => {
  const [viewMode, setViewMode] = useState<"segments" | "text">("segments");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCopy = async () => {
    const success = await copyToClipboard(result.text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (format: "txt" | "srt" | "vtt") => {
    const baseName = (result.fileName || "transcript").replace(/\.[^/.]+$/, "");
    if (format === "txt") {
      downloadFile(toTxt(result.text), `${baseName}.txt`, "text/plain");
    } else if (format === "srt") {
      downloadFile(toSrt(result.segments), `${baseName}.srt`, "text/plain");
    } else if (format === "vtt") {
      downloadFile(toVtt(result.segments), `${baseName}.vtt`, "text/vtt");
    }
  };

  const filteredSegments = result.segments.filter((s) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {/* File info banner */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-ink">
        <div className="overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-green uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5" />
            Transcription Complete
          </div>
          <p className="font-extrabold text-sm text-ink truncate max-w-[260px]">
            {result.fileName || "Speech Transcript"}
          </p>
        </div>

        <button
          onClick={onNew}
          className="px-2.5 py-1.5 rounded-lg border-2 border-ink bg-white hover:bg-btn-gray font-bold text-xs text-ink shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          + New
        </button>
      </div>

      {/* Action toolbars: View mode & Search */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-btn-gray border-2 border-ink rounded-lg p-0.5 shadow-neo-sm">
          <button
            onClick={() => setViewMode("segments")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
              viewMode === "segments" ? "bg-white text-ink border border-ink shadow-sm" : "text-text-gray"
            }`}
          >
            <List className="w-3 h-3" />
            Timestamps
          </button>
          <button
            onClick={() => setViewMode("text")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
              viewMode === "text" ? "bg-white text-ink border border-ink shadow-sm" : "text-text-gray"
            }`}
          >
            <FileText className="w-3 h-3" />
            Full Text
          </button>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-ink bg-white hover:bg-btn-gray font-bold text-xs text-ink shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-gray" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter or search words in transcript…"
          className="w-full pl-8 pr-3 py-1.5 bg-white border border-ink rounded-lg text-xs font-semibold text-ink focus:outline-none focus:border-indigo"
        />
      </div>

      {/* Transcript container */}
      <div className="max-h-[220px] overflow-y-auto bg-white border-2 border-ink rounded-neo p-3 shadow-neo-sm flex flex-col gap-2">
        {viewMode === "segments" ? (
          filteredSegments.length > 0 ? (
            filteredSegments.map((seg, idx) => (
              <div key={idx} className="segment-item">
                <span className="font-mono text-[10px] font-bold text-indigo bg-indigo/10 px-1.5 py-0.5 rounded border border-indigo/20 mr-2 select-all">
                  {formatTime(seg.start)} - {formatTime(seg.end)}
                </span>
                <span className="text-xs font-medium text-ink leading-relaxed select-text">
                  {seg.text}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-gray text-center py-4">No matching segments found.</p>
          )
        ) : (
          <p className="text-xs font-medium text-ink leading-relaxed whitespace-pre-wrap select-text">
            {result.text}
          </p>
        )}
      </div>

      {/* Export download buttons */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          onClick={() => handleDownload("txt")}
          className="btn-neo text-xs py-2 px-2"
          title="Download as Plain Text"
        >
          <Download className="w-3.5 h-3.5" />
          .TXT
        </button>
        <button
          onClick={() => handleDownload("srt")}
          className="btn-neo text-xs py-2 px-2"
          title="Download as Subtitles (SRT)"
        >
          <Download className="w-3.5 h-3.5" />
          .SRT
        </button>
        <button
          onClick={() => handleDownload("vtt")}
          className="btn-neo text-xs py-2 px-2"
          title="Download as Web Subtitles (VTT)"
        >
          <Download className="w-3.5 h-3.5" />
          .VTT
        </button>
      </div>
    </div>
  );
};
