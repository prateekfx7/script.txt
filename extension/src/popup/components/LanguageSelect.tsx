import React from "react";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../../lib/languages";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-text-gray uppercase tracking-wider">
        <Globe className="w-3.5 h-3.5 text-indigo" />
        Spoken Language
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-white border-2 border-ink rounded-lg px-3 py-2 text-sm font-semibold text-ink shadow-neo-sm focus:outline-none focus:ring-2 focus:ring-indigo disabled:opacity-50 cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
