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
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Feature Flags</h1>
      <p style={{ color: "#7A7A76", fontSize: 14, marginBottom: 28 }}>Global switches stored in flags.json — changes take effect immediately</p>

      {loading ? <p style={{ color: "#7A7A76", fontSize: 14 }}>Loading…</p> : flags && (
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
          {Object.keys(FLAG_META).map((key, i, arr) => {
            const meta = FLAG_META[key];
            const val = flags[key];
            const isLast = i === arr.length - 1;

            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderBottom: isLast ? "none" : "1px solid #f0f0f0",
                  gap: 20,
                }}
              >
                {/* Label */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#171717", marginBottom: 2 }}>{meta.label}</p>
                  <p style={{ fontSize: 12, color: "#7A7A76" }}>{meta.desc}</p>
                  <p style={{ fontSize: 10, color: "#aaa", marginTop: 2, fontFamily: "monospace" }}>{key}</p>
                </div>

                {/* Control */}
                {meta.type === "boolean" ? (
                  <button
                    onClick={() => toggle(key, !val)}
                    disabled={saving === key}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      background: val ? "#3222DD" : "#e5e5e5",
                      cursor: saving === key ? "not-allowed" : "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                      opacity: saving === key ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                    aria-label={`Toggle ${meta.label}`}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: val ? 22 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                      }}
                    />
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <input
                      type="number"
                      value={numEdit[key] ?? String(val)}
                      onChange={(e) => setNumEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveNum(key)}
                      min={0}
                      style={{ width: 72, border: "1px solid #e5e5e5", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontFamily: "monospace", outline: "none" }}
                    />
                    <button
                      onClick={() => saveNum(key)}
                      disabled={saving === key}
                      style={{ padding: "5px 10px", background: "#171717", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving === key ? "not-allowed" : "pointer", fontFamily: "inherit" }}
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
