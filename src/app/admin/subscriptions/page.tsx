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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-ink leading-tight font-pt-narrow">
            Subscriptions & Payments
          </h1>
          <p className="text-[15px] text-text-gray font-pt-narrow">
            Manage UPI manual reviews, active subscriptions, and user tiers.
          </p>
        </div>
        <input
          placeholder="Search by user email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border-2 border-ink rounded-[10px] px-4 py-2 text-[14px] text-ink outline-none w-full sm:w-[260px] shadow-[2px_2px_0_#171717] font-pt-narrow"
        />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-ink rounded-[16px] p-6 shadow-[4px_4px_0_#171717] border-t-4 border-t-indigo">
          <p className="text-[12px] text-text-gray font-bold tracking-wider uppercase mb-1 font-pt-narrow">
            Est. Monthly Recurring Revenue
          </p>
          <p className="text-[38px] font-bold text-indigo leading-none font-pt-narrow">
            ₹{mrr.toLocaleString("en-IN")}
          </p>
          <p className="text-[13px] text-text-gray mt-2 font-pt-narrow">
            from {subscribers.length} active Pro subscribers
          </p>
        </div>

        <div className="bg-white border-2 border-ink rounded-[16px] p-6 shadow-[4px_4px_0_#171717] border-t-4 border-t-[#FFE500]">
          <p className="text-[12px] text-text-gray font-bold tracking-wider uppercase mb-1 font-pt-narrow">
            Pending UPI Verifications
          </p>
          <p className="text-[38px] font-bold text-ink leading-none font-pt-narrow">
            {pendingList.length}
          </p>
          <p className="text-[13px] text-text-gray mt-2 font-pt-narrow">
            subscribers awaiting admin approval
          </p>
        </div>
      </div>

      {/* ── 1. PENDING UPI REVIEWS SECTION ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-[20px] font-bold text-ink font-pt-narrow">
            Pending UPI Submissions ({pendingList.length})
          </h2>
        </div>

        <div className="border-2 border-ink rounded-[16px] overflow-hidden shadow-[4px_4px_0_#171717] bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-amber-50 border-b-2 border-ink">
                {["User Email", "Plan", "Amount", "12-Digit UTR Number", "Submitted", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[12px] font-bold text-ink tracking-wider uppercase font-pt-narrow"
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
                  <td colSpan={6} className="p-8 text-center text-text-gray font-pt-narrow text-[15px]">
                    🎉 No pending UPI submissions! All payments are verified.
                  </td>
                </tr>
              ) : (
                pendingList.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-200 hover:bg-amber-50/40 transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 text-[14px] text-ink font-bold font-mono">
                      {p.email}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink uppercase font-bold font-pt-narrow">
                      {p.plan}
                    </td>
                    <td className="px-4 py-3 text-[14px] font-bold text-indigo font-pt-narrow">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono">
                      <span className="bg-gray-100 border border-gray-300 rounded px-2 py-1 font-bold text-ink select-all">
                        {p.utr}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyUtr(p.utr)}
                        className="ml-2 text-xs text-indigo font-bold hover:underline"
                      >
                        {copiedUtr === p.utr ? "✓ Copied" : "Copy"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-gray font-pt-narrow">
                      {fmtDate(p.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => doAction(p.id, "approve")}
                          disabled={actionLoading === p.id}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-[8px] text-[13px] font-bold font-pt-narrow border border-ink shadow-[1px_1px_0_#171717] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          ✓ Approve (Grant Pro)
                        </button>
                        <button
                          type="button"
                          onClick={() => doAction(p.id, "reject")}
                          disabled={actionLoading === p.id}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-[8px] text-[13px] font-bold font-pt-narrow border border-red-300 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          ✕ Reject Fake UTR
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
      <div className="space-y-3">
        <h2 className="text-[20px] font-bold text-ink font-pt-narrow">
          Active Subscribers ({filteredSubscribers.length})
        </h2>

        <div className="border-2 border-ink rounded-[16px] overflow-hidden shadow-[4px_4px_0_#171717] bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-ink">
                {["User Email", "Plan", "Status", "Amount", "Activated", "Renewal", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[12px] font-bold text-text-gray tracking-wider uppercase font-pt-narrow"
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
                  <td colSpan={7} className="p-8 text-center text-text-gray font-pt-narrow">
                    Loading subscriptions…
                  </td>
                </tr>
              ) : filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-gray font-pt-narrow leading-relaxed">
                    No active subscribers yet.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-200 hover:bg-gray-50/80 transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
                  >
                    <td className="px-4 py-3 text-[14px] text-ink font-mono">{s.email}</td>
                    <td className="px-4 py-3 text-[13px] text-ink uppercase font-bold font-pt-narrow">
                      {s.plan}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-green-100 text-green-800 border border-green-300 font-pt-narrow">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[14px] font-bold text-indigo font-pt-narrow">
                      ₹{s.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-gray font-pt-narrow">
                      {fmtDate(s.activatedAt)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-gray font-pt-narrow">
                      {fmtDate(s.renewalDate)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => doAction(s.id, "revoke")}
                        disabled={actionLoading === s.id}
                        className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 rounded-[8px] text-[12px] font-bold font-pt-narrow border border-red-300 transition-all cursor-pointer"
                      >
                        Revoke Access
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
