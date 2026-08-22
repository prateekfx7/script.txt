"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

interface Flags {
  ALLOW_GUEST_TRANSCRIPTION: boolean;
  MAINTENANCE_MODE: boolean;
  MAX_FREE_JOBS_PER_DAY: number;
  [key: string]: boolean | number | string;
}

const FLAG_META: Record<string, { label: string; desc: string; type: "boolean" | "number" }> = {
  ALLOW_GUEST_TRANSCRIPTION: {
    label: "Allow Guest Transcription",
    desc: "Let non-logged-in users run transcription jobs",
    type: "boolean",
  },
  MAINTENANCE_MODE: {
    label: "Maintenance Mode",
    desc: "Show a maintenance banner on the main site",
    type: "boolean",
  },
  MAX_FREE_JOBS_PER_DAY: {
    label: "Max Free Jobs / Day",
    desc: "How many free jobs an unsubscribed user can run per day",
    type: "number",
  },
};

export default function AdminFlagsPage() {
  const { session } = useAuth();
  const [flags, setFlags] = useState<Flags | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [numEdit, setNumEdit] = useState<Record<string, string>>({});

  const token = session?.access_token ?? "";

  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/flags", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setFlags(d.flags);
        const edits: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.flags ?? {})) {
          if (typeof v === "number") edits[k] = String(v);
        }
        setNumEdit(edits);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const toggle = async (key: string, value: boolean | number) => {
    setSaving(key);
    const res = await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const d = await res.json();
    setFlags(d.flags);
    setSaving(null);
  };

  const saveNum = async (key: string) => {
    const val = parseInt(numEdit[key] ?? "0", 10);
    if (isNaN(val)) return;
    await toggle(key, val);
  };

  return (
    <div className="font-sfpro">
      <h1 className="text-[24px] font-bold text-ink mb-1 tracking-tight">Feature Flags</h1>
      <p className="text-[14px] text-text-gray-2 mb-8">Global switches stored in flags.json — changes take effect immediately</p>

      {loading ? <p className="text-[14px] text-text-gray-2 animate-pulse">Loading…</p> : flags && (
        <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
          {Object.keys(FLAG_META).map((key, i, arr) => {
            const meta = FLAG_META[key];
            const val = flags[key];
            const isLast = i === arr.length - 1;

            return (
              <div
                key={key}
                className={`flex items-center px-6 py-5 hover:bg-gray-50 transition-colors gap-5 ${
                  isLast ? "" : "border-b border-gray-100"
                }`}
              >
                {/* Label */}
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-ink mb-1 tracking-tight">{meta.label}</p>
                  <p className="text-[13px] text-text-gray-2">{meta.desc}</p>
                  <p className="text-[11px] text-gray-400 mt-1 font-mono tracking-wider">{key}</p>
                </div>

                {/* Control */}
                {meta.type === "boolean" ? (
                  <button
                    onClick={() => toggle(key, !val)}
                    disabled={saving === key}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo ${
                      val ? "bg-indigo" : "bg-gray-200"
                    } ${saving === key ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
                    aria-label={`Toggle ${meta.label}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        val ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="number"
                      value={numEdit[key] ?? String(val)}
                      onChange={(e) => setNumEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveNum(key)}
                      min={0}
                      className="w-20 border border-gray-200 rounded-[8px] px-3 py-1.5 text-[14px] font-mono outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all"
                    />
                    <button
                      onClick={() => saveNum(key)}
                      disabled={saving === key}
                      className="px-4 py-1.5 bg-ink border border-ink rounded-[8px] text-white font-bold text-[13px] hover:bg-black transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving === key ? "…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
