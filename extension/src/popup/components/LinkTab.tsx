import React, { useState } from "react";
import { Link2, Zap, X, Video, Radio } from "lucide-react";

interface LinkTabProps {
  url: string;
  onUrlChange: (url: string) => void;
  disabled?: boolean;
}

export const LinkTab: React.FC<LinkTabProps> = ({ url, onUrlChange, disabled }) => {
  const [detecting, setDetecting] = useState(false);

  const handleDetectCurrentTab = async () => {
    if (disabled || detecting) return;
    setDetecting(true);
    try {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && !tab.url.startsWith("chrome://")) {
          onUrlChange(tab.url);
        } else {
          alert("Active tab is not a valid webpage URL.");
        }
      } else {
        // Browser preview fallback
        onUrlChange("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      }
    } catch (err) {
      console.error("Tab detection error:", err);
    } finally {
      setDetecting(false);
    }
  };

  const isYouTube = url.toLowerCase().includes("youtube.com") || url.toLowerCase().includes("youtu.be");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-gray">
          {isYouTube ? <Video className="w-4 h-4 text-red-600" /> : <Link2 className="w-4 h-4" />}
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="Paste YouTube, podcast, or audio URL…"
          disabled={disabled}
          className="w-full pl-9 pr-8 py-2.5 bg-white border-2 border-ink rounded-lg text-sm font-semibold text-ink shadow-neo-sm focus:outline-none focus:ring-2 focus:ring-indigo disabled:opacity-50"
        />
        {url && (
          <button
            onClick={() => onUrlChange("")}
            disabled={disabled}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-text-gray hover:text-ink"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleDetectCurrentTab}
          disabled={disabled || detecting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-ink bg-white hover:bg-btn-gray text-xs font-bold text-ink shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-indigo fill-indigo" />
          {detecting ? "Detecting…" : "Use Current Tab URL"}
        </button>

        <span className="flex items-center gap-1 text-[11px] font-bold text-text-gray">
          <Radio className="w-3 h-3 text-green animate-pulse" />
          YouTube & Web Audio
        </span>
      </div>
    </div>
  );
};
