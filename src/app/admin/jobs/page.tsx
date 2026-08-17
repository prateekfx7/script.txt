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
    await Promise.all([...selected].map((id) =>
      fetch(`/api/admin/jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    ));
    setBulkLoading(false);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Jobs</h1>
          <p style={{ color: "#7A7A76", fontSize: 14 }}>{total} total</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {selected.size > 0 && (
            <button onClick={bulkDelete} disabled={bulkLoading}
              style={{ fontSize: 12, fontWeight: 600, color: "#e53e3e", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 12px", cursor: bulkLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {bulkLoading ? "Deleting…" : `Delete ${selected.size} selected`}
            </button>
          )}
          <button onClick={downloadCsv} disabled={exporting}
            style={{ fontSize: 12, fontWeight: 600, color: "#5B5B58", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 12px", cursor: exporting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => switchTab(t)}
            style={{ padding: "5px 12px", background: tab === t ? "#171717" : "#fff", border: "1px solid " + (tab === t ? "#171717" : "#e5e5e5"), borderRadius: 6, color: tab === t ? "#fff" : "#5B5B58", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <input
            placeholder="Search filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "5px 10px", color: "#171717", fontSize: 12, outline: "none", width: 180, fontFamily: "inherit" }}
          />
          <button onClick={doSearch}
            style={{ padding: "5px 12px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, color: "#5B5B58", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Search
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: "#7A7A76", fontSize: 14 }}>Loading…</p> : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                  <th style={{ padding: "10px 14px", width: 36 }}>
                    <input type="checkbox" checked={selected.size === jobs.length && jobs.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} />
                  </th>
                  {["File", "Type", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7A7A76", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#7A7A76", fontSize: 14 }}>No jobs found</td></tr>
                ) : jobs.map((j, i) => (
                  <tr key={j.id} style={{ borderBottom: i < jobs.length - 1 ? "1px solid #f0f0f0" : "none", background: selected.has(j.id) ? "#fafafe" : "transparent" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleSelect(j.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#171717", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.fileName}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#7A7A76", textTransform: "uppercase", letterSpacing: "0.05em" }}>{j.sourceType}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[j.status] ?? "#7A7A76" }}>{j.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#7A7A76" }}>{fmtDate(j.createdAt)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        {j.transcriptPreview && <TxtBtn label="View" color="#3222DD" loading={false} onClick={() => setPreview(j)} />}
                        {(j.status === "failed" || j.status === "pending") && <TxtBtn label="Retry" color="#d97706" loading={actionLoading === j.id} onClick={() => doAction("retry", j)} />}
                        <TxtBtn label="Delete" color="#e53e3e" loading={actionLoading === j.id} onClick={() => doAction("delete", j)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
              <PageBtn label="← Prev" disabled={page === 1} onClick={() => { setPage(page - 1); load(tab, page - 1, search); }} />
              <span style={{ color: "#7A7A76", fontSize: 12, display: "flex", alignItems: "center", padding: "0 8px" }}>
                {page} / {totalPages}
              </span>
              <PageBtn label="Next →" disabled={page === totalPages} onClick={() => { setPage(page + 1); load(tab, page + 1, search); }} />
            </div>
          )}
        </>
      )}

      {/* Transcript modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setPreview(null)}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "24px 28px", maxWidth: 560, width: "90%", maxHeight: "70vh", overflow: "auto", border: "1px solid #e5e5e5" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Transcript Preview</h2>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", color: "#7A7A76", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: "#7A7A76", marginBottom: 12, fontFamily: "monospace" }}>{preview.fileName}</p>
            <p style={{ color: "#171717", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {preview.transcriptPreview}
              {(preview.transcriptPreview?.length ?? 0) >= 200 && <span style={{ color: "#aaa" }}>… (truncated)</span>}
            </p>
            {preview.transcriptId && (
              <a href={`/transcript/${preview.transcriptId}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 14, color: "#3222DD", fontSize: 13 }}>
                Open full transcript →
              </a>
            )}
          </div>
        </div>
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

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "5px 10px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, color: disabled ? "#ccc" : "#5B5B58", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );
}
