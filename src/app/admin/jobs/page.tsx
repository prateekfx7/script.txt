"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";

interface AdminJob {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  errorMsg: string | null;
  createdAt: string;
  transcriptPreview: string | null;
  transcriptId: string | null;
}

const STATUS_COLOR: Record<string, string> = { done: "#26A94C", failed: "#e53e3e", pending: "#d97706", processing: "#2563eb" };
const TABS = ["all", "pending", "processing", "done", "failed"] as const;
type Tab = typeof TABS[number];

export default function AdminJobsPage() {
  const { session } = useAuth();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [preview, setPreview] = useState<AdminJob | null>(null);
  const [exporting, setExporting] = useState(false);

  const token = session?.access_token ?? "";
  const pageSize = 50;

  const load = useCallback((t = tab, p = page, q = search) => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ status: t, page: String(p), ...(q ? { q } : {}) });
    fetch(`/api/admin/jobs?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setTotal(d.total ?? 0); setSelected(new Set()); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, tab, page, search]);

  useEffect(() => { load(); }, [token]);

  const switchTab = (t: Tab) => { setTab(t); setPage(1); load(t, 1, search); };
  const doSearch = () => { setSearch(searchInput); setPage(1); load(tab, 1, searchInput); };

  const doAction = async (type: "retry" | "delete", job: AdminJob) => {
    setActionLoading(job.id);
    try {
      await fetch(`/api/admin/jobs/${job.id}`, { method: type === "delete" ? "DELETE" : "POST", headers: { Authorization: `Bearer ${token}` } });
      load();
    } finally { setActionLoading(null); }
  };

  const bulkDelete = async () => {
    setBulkLoading(true);
    await Promise.all(Array.from(selected).map((id) =>
      fetch(`/api/admin/jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    ));
    setBulkLoading(false);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id)));
  };

  const downloadCsv = async () => {
    setExporting(true);
    const resp = await fetch("/api/admin/jobs?export=csv", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `jobs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="font-sfpro">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-ink mb-1 tracking-tight">Jobs</h1>
          <p className="text-[14px] text-text-gray-2">{total} total</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="text-[13px] font-bold text-red-600 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 rounded-[8px] px-3.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {bulkLoading ? "Deleting…" : `Delete ${selected.size} selected`}
            </button>
          )}
          <button onClick={downloadCsv} disabled={exporting}
            className="text-[13px] font-bold text-ink bg-white border border-gray-200 hover:bg-gray-50 rounded-[8px] px-3.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex bg-gray-200/50 p-1 rounded-[10px]">
          {TABS.map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-bold capitalize transition-all ${
                tab === t ? "bg-white text-ink shadow-sm" : "text-text-gray-2 hover:text-ink"
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            placeholder="Search filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="bg-white border border-gray-200 rounded-[10px] px-3.5 py-2 text-ink text-[13px] outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all w-[220px]"
          />
          <button onClick={doSearch}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-[10px] text-ink font-bold text-[13px] hover:bg-gray-50 transition-colors">
            Search
          </button>
        </div>
      </div>

      {loading ? <p className="text-[14px] text-text-gray-2 animate-pulse">Loading…</p> : (
        <>
          <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input type="checkbox" checked={selected.size === jobs.length && jobs.length > 0} onChange={toggleAll} className="cursor-pointer rounded accent-ink" />
                  </th>
                  {["File", "Type", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold text-text-gray-2 tracking-wider uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-text-gray-2 text-[14px]">
                      No jobs found
                    </td>
                  </tr>
                ) : jobs.map((j, i) => (
                  <tr key={j.id} className={`hover:bg-gray-50 transition-colors ${i < jobs.length - 1 ? "border-b border-gray-100" : ""} ${selected.has(j.id) ? "bg-indigo/5" : ""}`}>
                    <td className="px-4 py-3.5 text-center">
                      <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleSelect(j.id)} className="cursor-pointer rounded accent-ink" />
                    </td>
                    <td className="px-4 py-3.5 text-[14px] text-ink font-medium max-w-[260px] truncate">{j.fileName}</td>
                    <td className="px-4 py-3.5 text-[11px] text-text-gray-2 tracking-wider uppercase font-bold">{j.sourceType}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${j.status === "done" ? "bg-green-50 text-green-600" : j.status === "failed" ? "bg-red-50 text-red-600" : j.status === "pending" ? "bg-orange-50 text-orange-500" : "bg-blue-50 text-blue-600"}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-text-gray-2 font-medium">{fmtDate(j.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-4">
                        {j.transcriptPreview && <TxtBtn label="View" className="text-indigo" loading={false} onClick={() => setPreview(j)} />}
                        {(j.status === "failed" || j.status === "pending") && <TxtBtn label="Retry" className="text-orange-500" loading={actionLoading === j.id} onClick={() => doAction("retry", j)} />}
                        <TxtBtn label="Delete" className="text-red-600" loading={actionLoading === j.id} onClick={() => doAction("delete", j)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <PageBtn label="← Prev" disabled={page === 1} onClick={() => { setPage(page - 1); load(tab, page - 1, search); }} />
              <span className="text-[13px] text-text-gray-2 font-bold px-2">
                {page} / {totalPages}
              </span>
              <PageBtn label="Next →" disabled={page === totalPages} onClick={() => { setPage(page + 1); load(tab, page + 1, search); }} />
            </div>
          )}
        </>
      )}

      {/* Transcript modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[999] p-4 transition-opacity" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-[16px] p-8 max-w-[560px] w-full max-h-[75vh] overflow-y-auto shadow-xl border border-gray-100 transform transition-transform" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[18px] font-bold text-ink tracking-tight">Transcript Preview</h2>
              <button onClick={() => setPreview(null)} className="text-text-gray-2 hover:text-ink transition-colors text-[20px] leading-none">✕</button>
            </div>
            <p className="text-[13px] text-text-gray-2 mb-4 font-mono">{preview.fileName}</p>
            <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
              {preview.transcriptPreview}
              {(preview.transcriptPreview?.length ?? 0) >= 200 && <span className="text-gray-400">… (truncated)</span>}
            </p>
            {preview.transcriptId && (
              <a href={`/transcript/${preview.transcriptId}`} target="_blank" rel="noreferrer"
                className="inline-block mt-5 text-[14px] font-bold text-indigo hover:underline">
                Open full transcript →
              </a>
            )}
          </div>
        </div>
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

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-[13px] font-bold text-ink hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {label}
    </button>
  );
}
