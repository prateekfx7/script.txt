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
  { key: "groq", label: "Groq API", desc: "Whisper transcription endpoint" },
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>System Health</h1>
          {data?.checkedAt && (
            <p style={{ color: "#7A7A76", fontSize: 13 }}>Last checked at {fmtTime(data.checkedAt)}</p>
          )}
        </div>
        <button
          onClick={check}
          disabled={loading}
          style={{ padding: "7px 16px", background: "#171717", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Checking…" : "Recheck"}
        </button>
      </div>

      {!data && loading && <p style={{ color: "#7A7A76", fontSize: 14 }}>Running checks…</p>}

      {data && (
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
          {SERVICES.map((svc, i) => {
            const result = data.results[svc.key];
            const ok = result?.ok ?? false;
            const latency = result?.latencyMs ?? 0;
            return (
              <div
                key={svc.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderBottom: i < SERVICES.length - 1 ? "1px solid #f0f0f0" : "none",
                  gap: 16,
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: !result ? "#e5e5e5" : ok ? "#26A94C" : "#e53e3e",
                  }}
                />

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#171717", marginBottom: 1 }}>{svc.label}</p>
                  <p style={{ fontSize: 12, color: "#7A7A76" }}>
                    {result?.error ?? svc.desc}
                  </p>
                </div>

                {/* Latency */}
                {result && ok && (
                  <span style={{ fontSize: 12, color: "#7A7A76", fontFamily: "monospace" }}>
                    {latency}ms
                  </span>
                )}

                {/* Status label */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: !result ? "#aaa" : ok ? "#26A94C" : "#e53e3e",
                    minWidth: 48,
                    textAlign: "right",
                  }}
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
