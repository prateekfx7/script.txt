import React from "react";
import { Loader2, Cpu, HardDriveDownload } from "lucide-react";
import { TranscribeProgress } from "../../lib/types";

interface ProgressBarProps {
  progress?: TranscribeProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const status = progress?.status || "Processing audio…";
  const pct = Math.min(100, Math.max(0, Math.round(progress?.progress ?? 20)));
  const isModel = !!progress?.isModelLoading;

  return (
    <div className="flex flex-col gap-2.5 p-4 bg-white border-2 border-ink rounded-neo shadow-neo">
      <div className="flex items-center justify-between text-xs font-extrabold text-ink">
        <div className="flex items-center gap-2">
          {isModel ? (
            <HardDriveDownload className="w-4 h-4 text-indigo animate-bounce" />
          ) : (
            <Cpu className="w-4 h-4 text-green" />
          )}
          <span className="truncate max-w-[260px]">{status}</span>
        </div>
        <span className="font-mono text-indigo font-bold">{pct}%</span>
      </div>

      {/* Progress track */}
      <div className="w-full h-3.5 bg-btn-gray border-2 border-ink rounded-full overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isModel ? "bg-indigo" : "bg-green"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold text-text-gray pt-1">
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-ink" />
          <span>Running locally on WebAssembly</span>
        </div>
        <span>Zero API costs</span>
      </div>
    </div>
  );
};
