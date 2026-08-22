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
    <div className="font-sfpro">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-ink mb-1 tracking-tight">Users</h1>
          <p className="text-[14px] text-text-gray-2">{users.length} total accounts</p>
        </div>
        <input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-200 rounded-[10px] px-4 py-2.5 text-ink text-[14px] outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all w-[260px]"
        />
      </div>

      {loading ? <p className="text-[14px] text-text-gray-2 animate-pulse">Loading…</p> : (
        <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Email", "Joined", "Last Sign In", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold text-text-gray-2 tracking-wider uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-gray-2 text-[14px]">
                    No users found
                  </td>
                </tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <td className="px-5 py-3.5 text-[14px] text-ink font-mono">{u.email ?? "—"}</td>
                  <td className="px-5 py-3.5 text-[13px] text-text-gray-2 font-medium">{fmtDate(u.createdAt)}</td>
                  <td className="px-5 py-3.5 text-[13px] text-text-gray-2 font-medium">{fmtDate(u.lastSignIn)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${u.banned ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                      {u.banned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-4">
                      <TxtBtn label={u.banned ? "Unban" : "Ban"} className={u.banned ? "text-green-600" : "text-orange-500"} loading={actionLoading === u.id} onClick={() => setConfirm({ type: u.banned ? "unban" : "ban", user: u })} />
                      <TxtBtn label="Credits" className="text-indigo" loading={false} onClick={() => openCredits(u)} />
                      <TxtBtn label="Delete" className="text-red-600" loading={actionLoading === u.id} onClick={() => setConfirm({ type: "delete", user: u })} />
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
          <h2 className="text-[18px] font-bold text-ink mb-1 tracking-tight">Edit Credits</h2>
          <p className="text-[13px] text-text-gray-2 mb-5 font-mono">{creditsPopover.email}</p>
          <label className="text-[12px] font-bold text-text-gray tracking-wide block mb-2">Credits</label>
          <input
            type="number"
            value={creditsInput}
            onChange={(e) => setCreditsInput(e.target.value)}
            min={0}
            className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-[15px] outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all mb-5"
          />
          <div className="flex gap-3">
            <button onClick={saveCredits} disabled={creditsSaving}
              className="flex-1 py-2.5 bg-ink border border-ink rounded-[10px] text-white font-bold text-[13px] hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {creditsSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setCreditsPopover(null)}
              className="flex-1 py-2.5 bg-white border border-gray-200 rounded-[10px] text-ink font-bold text-[13px] hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm modal */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2 className="text-[18px] font-bold text-ink mb-2 capitalize tracking-tight">Confirm {confirm.type}</h2>
          <p className="text-[14px] text-text-gray mb-6 leading-relaxed">
            {confirm.type === "delete" ? "Permanently delete " : `${confirm.type === "ban" ? "Ban" : "Unban"} `}
            <strong className="font-mono text-ink">{confirm.user.email}</strong>?
            {confirm.type === "delete" && " This cannot be undone."}
          </p>
          <div className="flex gap-3">
            <button onClick={() => doAction(confirm.type, confirm.user)}
              className={`flex-1 py-2.5 rounded-[10px] text-white font-bold text-[13px] transition-colors ${confirm.type === "delete" ? "bg-red-600 hover:bg-red-700" : confirm.type === "ban" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"}`}>
              Yes, {confirm.type}
            </button>
            <button onClick={() => setConfirm(null)}
              className="flex-1 py-2.5 bg-white border border-gray-200 rounded-[10px] text-ink font-bold text-[13px] hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TxtBtn({ label, className, onClick, loading }: { label: string; className: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`text-[12px] font-bold tracking-wide hover:opacity-70 transition-opacity disabled:cursor-not-allowed ${loading ? "text-gray-400" : className}`}>
      {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[999] p-4 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-[16px] p-8 max-w-[400px] w-full shadow-xl border border-gray-100 transform transition-transform" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
