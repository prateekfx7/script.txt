import React from "react";
import { Mic, ShieldCheck, RotateCcw } from "lucide-react";

interface HeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, showReset }) => {
  return (
    <header className="flex items-center justify-between pb-3 mb-3 border-b-2 border-ink">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo border-2 border-ink shadow-neo-sm flex items-center justify-center text-white">
          <Mic className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="font-mono text-xl font-extrabold tracking-tight text-ink leading-none">
            scribe<span className="text-indigo">.txt</span>
          </h1>
          <div className="flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3 h-3 text-green" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-green">
              100% On-Device AI
            </span>
          </div>
        </div>
      </div>

      {showReset && (
        <button
          onClick={onReset}
          title="Start new transcription"
          className="p-1.5 rounded-lg border-2 border-ink bg-white hover:bg-btn-gray transition-colors text-ink shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
    </header>
  );
};
