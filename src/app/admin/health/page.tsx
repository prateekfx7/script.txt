"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

interface CheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface HealthData {
  results: Record<string, CheckResult>;
  checkedAt: string;
}

const SERVICES: { key: string; label: string; desc: string }[] = [
  { key: "database", label: "Database", desc: "PostgreSQL via Prisma" },
  { key: "supabase", label: "Supabase Auth", desc: "Service role key + admin API" },
  { key: "inngest", label: "Inngest", desc: "Local dev server at :8288" },
  { key: "openai", label: "AI Whisper Engine (Groq / OpenAI)", desc: "Whisper transcription endpoint" },
  { key: "flags", label: "Feature Flags", desc: "flags.json read access" },
];

export default function AdminHealthPage() {
  const { session } = useAuth();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const check = () => {
    if (!session?.access_token) return;
    setLoading(true);
    fetch("/api/admin/health", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { check(); }, [session]);

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="font-sfpro">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-ink mb-1 tracking-tight">System Health</h1>
          {data?.checkedAt && (
            <p className="text-[14px] text-text-gray-2">Last checked at {fmtTime(data.checkedAt)}</p>
          )}
        </div>
        <button
          onClick={check}
          disabled={loading}
          className="px-5 py-2.5 bg-ink text-white font-bold text-[13px] rounded-[10px] hover:bg-black transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Checking…" : "Recheck"}
        </button>
      </div>

      {!data && loading && <p className="text-[14px] text-text-gray-2 animate-pulse">Running checks…</p>}

      {data && (
        <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
          {SERVICES.map((svc, i) => {
            const result = data.results[svc.key];
            const ok = result?.ok ?? false;
            const latency = result?.latencyMs ?? 0;
            return (
              <div
                key={svc.key}
                className={`flex items-center px-6 py-5 hover:bg-gray-50 transition-colors gap-5 ${
                  i < SERVICES.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {/* Status dot */}
                <div
                  className={`w-3 h-3 rounded-full shrink-0 shadow-inner ${
                    !result ? "bg-gray-300" : ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"
                  }`}
                />

                {/* Label */}
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-ink mb-1 tracking-tight">{svc.label}</p>
                  <p className={`text-[13px] ${!ok && result ? "text-red-600 font-medium" : "text-text-gray-2"}`}>
                    {result?.error ?? svc.desc}
                  </p>
                </div>

                {/* Latency */}
                {result && ok && (
                  <span className="text-[13px] text-text-gray-2 font-mono bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                    {latency}ms
                  </span>
                )}

                {/* Status label */}
                <span
                  className={`text-[13px] font-bold uppercase tracking-wider min-w-[60px] text-right ${
                    !result ? "text-gray-400" : ok ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {!result ? "—" : ok ? "OK" : "Error"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
