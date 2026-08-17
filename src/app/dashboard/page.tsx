"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import { SUPPORTED_LANGUAGES } from "@/components/landing/Dropzone";

type Tab = "transcripts" | "account" | "subscription" | "stats" | "billing";

interface TranscriptItem {
  jobId: string;
  fileName: string;
  language: string | null;
  engine: string | null;
  starred: boolean;
  createdAt: string;
  sourceType: string;
  textPreview: string;
  segmentCount: number;
  durationSecs: number;
}

interface StatsData {
  totalCount: number;
  weekCount: number;
  monthCount: number;
  totalDurationMins: number;
  langBreakdown: Record<string, number>;
  engineBreakdown: Record<string, number>;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "transcripts", label: "My Transcripts", icon: "📝" },
  { key: "account", label: "Account", icon: "👤" },
  { key: "subscription", label: "Subscription", icon: "👑" },
  { key: "stats", label: "Usage Stats", icon: "📊" },
  { key: "billing", label: "Billing", icon: "🧾" },
];

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("transcripts");

  // ── Transcripts State ──
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStarred, setFilterStarred] = useState(false);

  // ── Stats State ──
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const authHeaders = useCallback((): Record<string, string> => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session]);

  // ── Load Transcripts ──
  const loadTranscripts = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingTranscripts(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStarred) params.set("starred", "true");
      const res = await fetch(`/api/dashboard/transcripts?${params}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setTranscripts(data.transcripts || []);
    } catch (err) {
      console.error("Load transcripts error:", err);
    } finally {
      setLoadingTranscripts(false);
    }
  }, [session, searchQuery, filterStarred, authHeaders]);

  // ── Load Stats ──
  const loadStats = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingStats(true);
    try {
      const res = await fetch("/api/dashboard/stats", {
        headers: authHeaders(),
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Load stats error:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [session, authHeaders]);

  useEffect(() => {
    if (activeTab === "transcripts") loadTranscripts();
    if (activeTab === "stats") loadStats();
  }, [activeTab, loadTranscripts, loadStats]);

  // ── Star / Unstar ──
  const toggleStar = async (jobId: string, currentStarred: boolean) => {
    await fetch("/api/dashboard/transcripts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ jobId, starred: !currentStarred }),
    });
    setTranscripts((prev) =>
      prev.map((t) => (t.jobId === jobId ? { ...t, starred: !currentStarred } : t))
    );
  };

  // ── Delete ──
  const deleteTranscript = async (jobId: string) => {
    if (!confirm("Delete this transcript permanently?")) return;
    await fetch("/api/dashboard/transcripts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ jobId }),
    });
    setTranscripts((prev) => prev.filter((t) => t.jobId !== jobId));
  };

  const sub = user?.user_metadata?.subscription;
  const isSubscriber = sub?.status === "active";
  const isPending = sub?.status === "pending_review";

  const getLangName = (code: string | null) => {
    if (!code) return "Auto Detect";
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-pt-narrow font-bold text-[32px] text-ink leading-tight">
          Dashboard
        </h1>
        <p className="font-pt-narrow text-[16px] text-text-gray mt-1">
          Manage your transcriptions, account, and subscription.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1 border-b-2 border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 font-pt-narrow font-bold text-[15px] rounded-t-lg transition-all whitespace-nowrap cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === tab.key
                ? "bg-white text-indigo border-indigo"
                : "text-text-gray hover:text-ink border-transparent hover:bg-gray-100"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: MY TRANSCRIPTS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "transcripts" && (
        <div>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="🔍 Search transcripts by filename…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadTranscripts()}
                className="w-full border-2 border-ink rounded-[12px] px-4 py-3 text-[15px] font-pt-narrow outline-none focus:border-indigo transition-colors"
              />
            </div>
            <button
              onClick={() => setFilterStarred(!filterStarred)}
              className={`btn-neo text-[14px] px-4 py-2 ${filterStarred ? "bg-[#FFE500]" : "bg-white"}`}
            >
              {filterStarred ? "⭐ Starred Only" : "☆ All"}
            </button>
            <button onClick={loadTranscripts} className="btn-neo text-[14px] px-4 py-2 bg-indigo text-white">
              Search
            </button>
          </div>

          {/* List */}
          {loadingTranscripts ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transcripts.length === 0 ? (
            <div className="bg-white border-2 border-ink rounded-[16px] p-12 text-center shadow-neo-sm">
              <div className="text-4xl mb-3">📝</div>
              <h3 className="font-pt-narrow font-bold text-[22px] text-ink mb-2">No transcripts yet</h3>
              <p className="font-pt-narrow text-[16px] text-text-gray mb-6">
                Upload a video or paste a link on the home page to start transcribing!
              </p>
              <Link href="/" className="btn-neo bg-indigo text-white text-[16px]">
                ⚡ Start Transcribing
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transcripts.map((t) => (
                <div
                  key={t.jobId}
                  className="bg-white border-2 border-ink rounded-[14px] p-4 flex items-start gap-4 shadow-neo-sm hover:shadow-neo transition-all group"
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-[10px] bg-indigo/10 border-2 border-indigo flex items-center justify-center text-xl shrink-0">
                    {t.sourceType === "link" ? "🔗" : "🎬"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/transcript/${t.jobId}`}
                      className="font-pt-narrow font-bold text-[16px] text-ink hover:text-indigo transition-colors truncate block"
                    >
                      {t.fileName}
                    </Link>
                    <p className="text-[13px] text-text-gray font-pt-narrow truncate mt-0.5">
                      {t.textPreview}…
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[11px] font-bold font-pt-narrow text-indigo bg-indigo/10 px-2 py-0.5 rounded">
                        {formatDuration(t.durationSecs)}
                      </span>
                      <span className="text-[11px] font-pt-narrow text-text-gray bg-gray-100 px-2 py-0.5 rounded">
                        {getLangName(t.language)}
                      </span>
                      <span className="text-[11px] font-bold font-pt-narrow px-2 py-0.5 rounded bg-[#FFE500]/40 text-ink border border-ink/20">
                        ⚡ PrateekAI Model
                      </span>
                      <span className="text-[11px] text-text-gray-2 font-pt-narrow">
                        {formatDate(t.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleStar(t.jobId, t.starred)}
                      className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-[#FFE500]/30 transition-colors cursor-pointer"
                      title={t.starred ? "Unstar" : "Star"}
                    >
                      {t.starred ? "⭐" : "☆"}
                    </button>
                    <a
                      href={`/api/export/${t.jobId}?format=txt`}
                      download
                      className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-indigo/10 transition-colors text-[14px]"
                      title="Download TXT"
                    >
                      📄
                    </a>
                    <a
                      href={`/api/export/${t.jobId}?format=srt`}
                      download
                      className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-indigo/10 transition-colors text-[14px]"
                      title="Download SRT"
                    >
                      🎬
                    </a>
                    <button
                      onClick={() => deleteTranscript(t.jobId)}
                      className="w-8 h-8 rounded-lg border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors text-[14px] cursor-pointer"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: ACCOUNT & PROFILE */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "account" && user && (
        <div className="max-w-lg">
          <div className="bg-white border-2 border-ink rounded-[16px] p-6 shadow-neo-sm">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b-2 border-gray-100">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-indigo text-white flex items-center justify-center text-[28px] font-bold font-pt-narrow border-2 border-ink shadow-neo-sm shrink-0">
                {(user.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <h2 className="font-pt-narrow font-bold text-[22px] text-ink">
                  {user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
                </h2>
                <p className="font-pt-narrow text-[14px] text-text-gray">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase tracking-wide">Email</label>
                <p className="font-pt-narrow text-[16px] text-ink mt-0.5">{user.email}</p>
              </div>
              <div>
                <label className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase tracking-wide">User ID</label>
                <p className="font-mono text-[13px] text-text-gray mt-0.5 break-all">{user.id}</p>
              </div>
              <div>
                <label className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase tracking-wide">Login Provider</label>
                <p className="font-pt-narrow text-[16px] text-ink mt-0.5 capitalize">
                  {user.app_metadata?.provider || "email"}
                </p>
              </div>
              <div>
                <label className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase tracking-wide">Account Created</label>
                <p className="font-pt-narrow text-[16px] text-ink mt-0.5">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", {
                    year: "numeric", month: "long", day: "numeric",
                  }) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: SUBSCRIPTION STATUS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "subscription" && (
        <div className="max-w-lg">
          <div className="bg-white border-2 border-ink rounded-[16px] p-6 shadow-neo-sm">
            {/* Current Plan Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-14 h-14 rounded-[14px] flex items-center justify-center text-2xl border-2 border-ink shrink-0 ${
                isSubscriber ? "bg-indigo" : isPending ? "bg-amber-100" : "bg-green-100"
              }`}>
                {isSubscriber ? "👑" : isPending ? "⏳" : "🆓"}
              </div>
              <div>
                <h2 className="font-pt-narrow font-bold text-[22px] text-ink">
                  {isSubscriber
                    ? `${(sub?.plan || "pro").toUpperCase()} Plan`
                    : isPending
                    ? "Payment Under Review"
                    : "Free Plan"}
                </h2>
                <p className="font-pt-narrow text-[14px] text-text-gray">
                  {isSubscriber
                    ? "Unlimited transcripts + Dedicated PrateekAI Model v2.4"
                    : isPending
                    ? "Your UTR is being verified by our admin team"
                    : "7 free transcripts daily with PrateekAI Model"}
                </p>
              </div>
            </div>

            {/* Subscription Details */}
            {(isSubscriber || isPending) && sub && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-[12px] border border-gray-200 mb-6">
                {sub.utr && (
                  <div className="flex justify-between items-center">
                    <span className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase">UTR</span>
                    <span className="font-mono text-[14px] text-ink">{sub.utr}</span>
                  </div>
                )}
                {sub.amount && (
                  <div className="flex justify-between items-center">
                    <span className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase">Amount</span>
                    <span className="font-pt-narrow text-[14px] text-ink font-bold">₹{sub.amount}</span>
                  </div>
                )}
                {sub.activatedAt && (
                  <div className="flex justify-between items-center">
                    <span className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase">Activated</span>
                    <span className="font-pt-narrow text-[14px] text-ink">
                      {new Date(sub.activatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
                {sub.renewalDate && (
                  <div className="flex justify-between items-center">
                    <span className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase">Renewal</span>
                    <span className="font-pt-narrow text-[14px] text-ink">
                      {new Date(sub.renewalDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-pt-narrow font-bold text-[13px] text-text-gray uppercase">Status</span>
                  <span className={`font-pt-narrow text-[13px] font-bold px-2 py-0.5 rounded ${
                    isSubscriber ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {isSubscriber ? "✓ Active" : "⏳ Pending Review"}
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            {!isSubscriber && (
              <Link
                href="/#pricing"
                className="btn-neo w-full justify-center py-3 text-[17px] bg-indigo text-white"
              >
                ⚡ {isPending ? "Check Payment Status" : "Upgrade to Pro"}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: USAGE STATS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "stats" && (
        <div>
          {loadingStats ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Total Transcripts", value: stats.totalCount, icon: "📝", color: "bg-indigo/10 text-indigo" },
                  { label: "This Week", value: stats.weekCount, icon: "📅", color: "bg-green-100 text-green-800" },
                  { label: "This Month", value: stats.monthCount, icon: "📆", color: "bg-blue-100 text-blue-800" },
                  { label: "Total Minutes", value: stats.totalDurationMins, icon: "⏱️", color: "bg-purple-100 text-purple-800" },
                ].map((card) => (
                  <div key={card.label} className="bg-white border-2 border-ink rounded-[14px] p-5 shadow-neo-sm">
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="font-pt-narrow font-bold text-[30px] text-ink">{card.value}</div>
                    <div className="font-pt-narrow text-[13px] text-text-gray">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Engine Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-ink rounded-[14px] p-5 shadow-neo-sm">
                  <h3 className="font-pt-narrow font-bold text-[18px] text-ink mb-4">⚡ PrateekAI Engine Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-pt-narrow text-[15px] text-ink flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo inline-block" /> PrateekAI Ultra Neural Model
                      </span>
                      <span className="font-pt-narrow font-bold text-[17px] text-ink">{stats.totalCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-pt-narrow text-[15px] text-ink flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Neural Precision
                      </span>
                      <span className="font-pt-narrow font-bold text-[14px] text-indigo bg-indigo/10 px-2 py-0.5 rounded border border-indigo/20">99.4% Accuracy</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-ink rounded-[14px] p-5 shadow-neo-sm">
                  <h3 className="font-pt-narrow font-bold text-[18px] text-ink mb-4">🗣️ By Language</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {Object.entries(stats.langBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([lang, count]) => (
                        <div key={lang} className="flex justify-between items-center">
                          <span className="font-pt-narrow text-[14px] text-ink">{getLangName(lang)}</span>
                          <span className="font-pt-narrow font-bold text-[15px] text-indigo">{count}</span>
                        </div>
                      ))}
                    {Object.keys(stats.langBreakdown).length === 0 && (
                      <p className="font-pt-narrow text-[14px] text-text-gray">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="font-pt-narrow text-text-gray">Failed to load stats.</p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: BILLING HISTORY */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "billing" && (
        <div className="max-w-lg">
          <div className="bg-white border-2 border-ink rounded-[16px] p-6 shadow-neo-sm">
            <h3 className="font-pt-narrow font-bold text-[20px] text-ink mb-4">Payment History</h3>

            {sub?.utr ? (
              <div className="border-2 border-gray-200 rounded-[12px] overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="font-pt-narrow font-bold text-[15px] text-ink">
                      {(sub.plan || "Pro").toUpperCase()} Plan
                    </span>
                    <span className={`font-pt-narrow text-[12px] font-bold px-2 py-0.5 rounded ${
                      sub.status === "active"
                        ? "bg-green-100 text-green-800"
                        : sub.status === "pending_review"
                        ? "bg-amber-100 text-amber-800"
                        : sub.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {sub.status === "active" ? "✓ Approved" : sub.status === "pending_review" ? "⏳ Pending" : sub.status === "rejected" ? "✕ Rejected" : sub.status}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="font-pt-narrow text-[13px] text-text-gray">UTR Reference</span>
                    <span className="font-mono text-[13px] text-ink">{sub.utr}</span>
                  </div>
                  {sub.amount && (
                    <div className="flex justify-between">
                      <span className="font-pt-narrow text-[13px] text-text-gray">Amount Paid</span>
                      <span className="font-pt-narrow font-bold text-[14px] text-ink">₹{sub.amount}</span>
                    </div>
                  )}
                  {sub.submittedAt && (
                    <div className="flex justify-between">
                      <span className="font-pt-narrow text-[13px] text-text-gray">Submitted</span>
                      <span className="font-pt-narrow text-[13px] text-ink">
                        {new Date(sub.submittedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  {sub.activatedAt && (
                    <div className="flex justify-between">
                      <span className="font-pt-narrow text-[13px] text-text-gray">Activated</span>
                      <span className="font-pt-narrow text-[13px] text-ink">
                        {new Date(sub.activatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🧾</div>
                <p className="font-pt-narrow text-[16px] text-text-gray mb-4">No payment history yet</p>
                <Link href="/#pricing" className="btn-neo bg-indigo text-white text-[15px]">
                  View Plans
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
