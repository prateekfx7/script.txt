"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

interface Subscriber {
  id: string;
  email: string;
  plan: string;
  status: string;
  amount: number;
  utr?: string | null;
  renewalDate: string | null;
  activatedAt: string | null;
}

interface PendingSubmission {
  id: string;
  email: string;
  plan: string;
  status: string;
  amount: number;
  utr: string;
  submittedAt: string | null;
}

export default function AdminSubscriptionsPage() {
  const { session } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const token = session?.access_token ?? "";

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/subscriptions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setSubscribers(d.subscribers ?? []);
        setPendingSubmissions(d.pendingSubmissions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const doAction = async (userId: string, action: "grant" | "approve" | "reject" | "revoke") => {
    setActionLoading(userId);
    try {
      await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const copyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const filteredSubscribers = subscribers.filter((s) =>
    (s.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pendingList = pendingSubmissions.filter((p) => p.status === "pending_review");
  const mrr = subscribers.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div className="space-y-8 font-sfpro">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-ink leading-tight tracking-tight mb-1">
            Subscriptions & Payments
          </h1>
          <p className="text-[14px] text-text-gray-2">
            Manage UPI manual reviews, active subscriptions, and user tiers.
          </p>
        </div>
        <input
          placeholder="Search by user email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-200 rounded-[10px] px-4 py-2.5 text-ink text-[14px] outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all w-full sm:w-[260px]"
        />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo" />
          <p className="text-[12px] text-text-gray-2 font-bold tracking-wider uppercase mb-2">
            Est. Monthly Recurring Revenue
          </p>
          <p className="text-[38px] font-bold text-indigo leading-none mb-2">
            ₹{mrr.toLocaleString("en-IN")}
          </p>
          <p className="text-[13px] text-text-gray-2 font-medium">
            from {subscribers.length} active Pro subscribers
          </p>
        </div>

        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
          <p className="text-[12px] text-text-gray-2 font-bold tracking-wider uppercase mb-2">
            Pending UPI Verifications
          </p>
          <p className="text-[38px] font-bold text-ink leading-none mb-2">
            {pendingList.length}
          </p>
          <p className="text-[13px] text-text-gray-2 font-medium">
            subscribers awaiting admin approval
          </p>
        </div>
      </div>

      {/* ── 1. PENDING UPI REVIEWS SECTION ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <h2 className="text-[18px] font-bold text-ink tracking-tight">
            Pending UPI Submissions ({pendingList.length})
          </h2>
        </div>

        <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-amber-50/50 border-b border-amber-100">
                {["User Email", "Plan", "Amount", "12-Digit UTR Number", "Submitted", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-[11px] font-bold text-amber-800 tracking-wider uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {pendingList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-gray-2 text-[14px]">
                    🎉 No pending UPI submissions! All payments are verified.
                  </td>
                </tr>
              ) : (
                pendingList.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-amber-50/30 transition-colors ${
                      i < pendingList.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <td className="px-5 py-4 text-[14px] text-ink font-mono">
                      {p.email}
                    </td>
                    <td className="px-5 py-4 text-[12px] text-ink uppercase font-bold tracking-wider">
                      {p.plan}
                    </td>
                    <td className="px-5 py-4 text-[14px] font-bold text-indigo">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-[13px] font-mono">
                      <span className="bg-gray-100 border border-gray-200 rounded-md px-2.5 py-1 font-bold text-ink select-all shadow-inner">
                        {p.utr}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyUtr(p.utr)}
                        className="ml-3 text-[12px] text-indigo font-bold hover:underline transition-all"
                      >
                        {copiedUtr === p.utr ? "✓ Copied" : "Copy"}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-text-gray-2 font-medium">
                      {fmtDate(p.submittedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => doAction(p.id, "approve")}
                          disabled={actionLoading === p.id}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-[8px] text-[12px] font-bold disabled:opacity-50 transition-colors shadow-sm"
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => doAction(p.id, "reject")}
                          disabled={actionLoading === p.id}
                          className="px-3.5 py-1.5 bg-white hover:bg-red-50 text-red-600 rounded-[8px] text-[12px] font-bold border border-red-200 hover:border-red-300 disabled:opacity-50 transition-colors"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. ACTIVE SUBSCRIBERS TABLE ── */}
      <div className="space-y-4">
        <h2 className="text-[18px] font-bold text-ink tracking-tight">
          Active Subscribers ({filteredSubscribers.length})
        </h2>

        <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                {["User Email", "Plan", "Status", "Amount", "Activated", "Renewal", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-[11px] font-bold text-text-gray-2 tracking-wider uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-gray-2 text-[14px] animate-pulse">
                    Loading subscriptions…
                  </td>
                </tr>
              ) : filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-gray-2 text-[14px]">
                    No active subscribers yet.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      i < filteredSubscribers.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <td className="px-5 py-4 text-[14px] text-ink font-mono">{s.email}</td>
                    <td className="px-5 py-4 text-[12px] text-ink uppercase font-bold tracking-wider">
                      {s.plan}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-600 tracking-wider uppercase">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[14px] font-bold text-indigo">
                      ₹{s.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-text-gray-2 font-medium">
                      {fmtDate(s.activatedAt)}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-text-gray-2 font-medium">
                      {fmtDate(s.renewalDate)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => doAction(s.id, "revoke")}
                        disabled={actionLoading === s.id}
                        className="px-3.5 py-1.5 bg-white hover:bg-red-50 text-red-600 rounded-[8px] text-[12px] font-bold border border-gray-200 hover:border-red-200 transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
