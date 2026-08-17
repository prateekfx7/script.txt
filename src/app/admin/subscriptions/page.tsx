"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

interface Subscriber {
  id: string;
  email: string;
  plan: string;
  status: string;
  amount: number;
  renewalDate: string | null;
  activatedAt: string | null;
}

export default function AdminSubscriptionsPage() {
  const { session } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const token = session?.access_token ?? "";

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/subscriptions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setSubscribers(d.subscribers ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const doAction = async (userId: string, action: "grant" | "revoke") => {
    setActionLoading(userId);
    try {
      await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      load();
    } finally { setActionLoading(null); }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const filtered = subscribers.filter((s) =>
    (s.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const mrr = subscribers.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#171717", marginBottom: 4 }}>Subscriptions</h1>
          <p style={{ color: "#7A7A76", fontSize: 15 }}>{subscribers.length} active subscribers</p>
        </div>
        <input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#fff", border: "2px solid #171717", borderRadius: 10,
            padding: "8px 14px", color: "#171717", fontSize: 14, outline: "none",
            width: 240, boxShadow: "2px 2px 0 #171717", fontFamily: "inherit",
          }}
        />
      </div>

      {/* MRR Card */}
      <div
        style={{
          display: "inline-block",
          background: "#fff",
          border: "2px solid #171717",
          borderRadius: 14,
          padding: "20px 28px",
          marginBottom: 28,
          boxShadow: "4px 4px 0 #171717",
          borderTop: "4px solid #3222DD",
          minWidth: 200,
        }}
      >
        <p style={{ fontSize: 11, color: "#7A7A76", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
          Est. MRR
        </p>
        <p style={{ fontSize: 40, fontWeight: 800, color: "#3222DD", lineHeight: 1 }}>
          ₹{mrr.toLocaleString("en-IN")}
        </p>
        <p style={{ fontSize: 12, color: "#7A7A76", marginTop: 6 }}>from active subscribers</p>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "#7A7A76" }}>Loading subscriptions…</p>
      ) : (
        <div style={{ border: "2px solid #171717", borderRadius: 14, overflow: "hidden", boxShadow: "4px 4px 0 #171717", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F5F5F3", borderBottom: "2px solid #171717" }}>
                {["Email", "Plan", "Status", "Amount", "Activated", "Renewal", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#5B5B58", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#7A7A76", lineHeight: 1.7 }}>
                    {subscribers.length === 0
                      ? "No active subscribers yet.\nSubscription info is stored in user_metadata after a successful Razorpay payment."
                      : "No results match your search"}
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #e5e5e5" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#171717", fontFamily: "monospace" }}>{s.email}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#5B5B58", textTransform: "capitalize" }}>{s.plan}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: s.status === "active" ? "#f0fff4" : "#fff0f0",
                        color: s.status === "active" ? "#276749" : "#c53030",
                        border: `1.5px solid ${s.status === "active" ? "#26A94C" : "#e53e3e"}`,
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#5B5B58" }}>
                      {s.amount ? `₹${s.amount.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#7A7A76" }}>{fmtDate(s.activatedAt)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#7A7A76" }}>{fmtDate(s.renewalDate)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <ActionBtn label="Grant" color="#26A94C" loading={actionLoading === s.id} onClick={() => doAction(s.id, "grant")} />
                        <ActionBtn label="Revoke" color="#e53e3e" loading={actionLoading === s.id} onClick={() => doAction(s.id, "revoke")} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, background: "#fff", border: `2px solid ${color}`, borderRadius: 6, color, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, fontFamily: "inherit" }}>
      {label}
    </button>
  );
}
