"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";

interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
  banned: boolean;
}

interface CreditsPopover {
  userId: string;
  email: string;
  current: number;
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: "ban" | "unban" | "delete"; user: AdminUser } | null>(null);
  const [creditsPopover, setCreditsPopover] = useState<CreditsPopover | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);

  const token = session?.access_token ?? "";

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCredits = async (u: AdminUser) => {
    const res = await fetch(`/api/admin/users/${u.id}/credits`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    setCreditsPopover({ userId: u.id, email: u.email, current: d.credits ?? 0 });
    setCreditsInput(String(d.credits ?? 0));
  };

  const saveCredits = async () => {
    if (!creditsPopover) return;
    setCreditsSaving(true);
    await fetch(`/api/admin/users/${creditsPopover.userId}/credits`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ credits: parseInt(creditsInput, 10) }),
    });
    setCreditsSaving(false);
    setCreditsPopover(null);
  };

  const doAction = async (type: "ban" | "unban" | "delete", user: AdminUser) => {
    setActionLoading(user.id);
    setConfirm(null);
    try {
      if (type === "delete") {
        await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
      } else {
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, action: type }),
        });
      }
      load();
    } finally { setActionLoading(null); }
  };

  const filtered = users.filter((u) => (u.email ?? "").toLowerCase().includes(search.toLowerCase()));

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Users</h1>
          <p style={{ color: "#7A7A76", fontSize: 14 }}>{users.length} total accounts</p>
        </div>
        <input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "7px 12px", color: "#171717", fontSize: 13, outline: "none", width: 220, fontFamily: "inherit" }}
        />
      </div>

      {loading ? <p style={{ color: "#7A7A76", fontSize: 14 }}>Loading…</p> : (
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                {["Email", "Joined", "Last Sign In", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7A7A76", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#7A7A76", fontSize: 14 }}>No users found</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#171717", fontFamily: "monospace" }}>{u.email ?? "—"}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "#7A7A76" }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "#7A7A76" }}>{fmtDate(u.lastSignIn)}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: u.banned ? "#e53e3e" : "#26A94C" }}>
                      {u.banned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <TxtBtn label={u.banned ? "Unban" : "Ban"} color={u.banned ? "#26A94C" : "#d97706"} loading={actionLoading === u.id} onClick={() => setConfirm({ type: u.banned ? "unban" : "ban", user: u })} />
                      <TxtBtn label="Credits" color="#3222DD" loading={false} onClick={() => openCredits(u)} />
                      <TxtBtn label="Delete" color="#e53e3e" loading={actionLoading === u.id} onClick={() => setConfirm({ type: "delete", user: u })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Credits popover */}
      {creditsPopover && (
        <Modal onClose={() => setCreditsPopover(null)}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Edit Credits</h2>
          <p style={{ fontSize: 13, color: "#7A7A76", marginBottom: 20, fontFamily: "monospace" }}>{creditsPopover.email}</p>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#5B5B58", display: "block", marginBottom: 6 }}>Credits</label>
          <input
            type="number"
            value={creditsInput}
            onChange={(e) => setCreditsInput(e.target.value)}
            min={0}
            style={{ width: "100%", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 15, fontFamily: "inherit", outline: "none", marginBottom: 16 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveCredits} disabled={creditsSaving}
              style={{ flex: 1, padding: 9, background: "#171717", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 13, cursor: creditsSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: creditsSaving ? 0.6 : 1 }}>
              {creditsSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setCreditsPopover(null)}
              style={{ flex: 1, padding: 9, background: "#F5F5F3", border: "1px solid #e5e5e5", borderRadius: 6, color: "#171717", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm modal */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, textTransform: "capitalize" }}>Confirm {confirm.type}</h2>
          <p style={{ fontSize: 13, color: "#5B5B58", marginBottom: 20, lineHeight: 1.6 }}>
            {confirm.type === "delete" ? "Permanently delete " : `${confirm.type === "ban" ? "Ban" : "Unban"} `}
            <strong style={{ fontFamily: "monospace" }}>{confirm.user.email}</strong>?
            {confirm.type === "delete" && " This cannot be undone."}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => doAction(confirm.type, confirm.user)}
              style={{ flex: 1, padding: 9, background: confirm.type === "delete" ? "#e53e3e" : confirm.type === "ban" ? "#d97706" : "#26A94C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Yes, {confirm.type}
            </button>
            <button onClick={() => setConfirm(null)}
              style={{ flex: 1, padding: 9, background: "#F5F5F3", border: "1px solid #e5e5e5", borderRadius: 6, color: "#171717", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TxtBtn({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: loading ? "#ccc" : color, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 10, padding: "28px 28px", maxWidth: 380, width: "90%", border: "1px solid #e5e5e5" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
