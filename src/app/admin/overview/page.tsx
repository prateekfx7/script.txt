"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Stats {
  totalJobs: number;
  totalUsers: number;
  statusMap: Record<string, number>;
  jobsByDay: { date: string; count: number }[];
  usersByDay: { date: string; count: number }[];
}

interface RecentJob {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
}

const STATUS_ICON: Record<string, string> = { done: "✓", failed: "✗", pending: "·", processing: "⟳" };
const STATUS_COLOR: Record<string, string> = { done: "#26A94C", failed: "#e53e3e", pending: "#d97706", processing: "#2563eb" };

export default function AdminOverviewPage() {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    const h = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch("/api/admin/stats", { headers: h }).then((r) => r.json()),
      fetch("/api/admin/jobs?page=1&status=all", { headers: h }).then((r) => r.json()),
    ]).then(([s, j]) => {
      setStats(s);
      setRecent((j.jobs ?? []).slice(0, 20));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session]);

  const fmtDay = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" });

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Overview</h1>
      <p style={{ color: "#7A7A76", marginBottom: 32, fontSize: 14 }}>Platform health at a glance</p>

      {loading ? <p style={{ color: "#7A7A76", fontSize: 14 }}>Loading…</p> : (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: "#e5e5e5", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 40 }}>
            {[
              { label: "Users", value: stats?.totalUsers ?? 0 },
              { label: "Total Jobs", value: stats?.totalJobs ?? 0 },
              { label: "Done", value: stats?.statusMap?.done ?? 0, color: "#26A94C" },
              { label: "Failed", value: stats?.statusMap?.failed ?? 0, color: "#e53e3e" },
              { label: "Pending", value: stats?.statusMap?.pending ?? 0, color: "#d97706" },
              { label: "Processing", value: stats?.statusMap?.processing ?? 0, color: "#2563eb" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", padding: "20px 16px" }}>
                <p style={{ fontSize: 11, color: "#7A7A76", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color ?? "#171717", lineHeight: 1 }}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5", padding: "20px 24px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#7A7A76", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>Jobs — last 7 days</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats?.jobsByDay ?? []}>
                  <CartesianGrid stroke="#f5f5f5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: "#7A7A76", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#7A7A76", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 12 }} labelFormatter={(v) => fmtDay(v as string)} />
                  <Line type="monotone" dataKey="count" stroke="#3222DD" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#3222DD" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5", padding: "20px 24px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#7A7A76", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>New Users — last 7 days</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats?.usersByDay ?? []}>
                  <CartesianGrid stroke="#f5f5f5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: "#7A7A76", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#7A7A76", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 12 }} labelFormatter={(v) => fmtDay(v as string)} />
                  <Bar dataKey="count" fill="#171717" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity feed */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#171717", marginBottom: 12 }}>Recent Activity</p>
            <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
              {recent.length === 0 ? (
                <p style={{ padding: 20, color: "#7A7A76", fontSize: 13 }}>No recent jobs.</p>
              ) : (
                recent.map((j, i) => (
                  <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < recent.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ fontSize: 14, color: STATUS_COLOR[j.status] ?? "#7A7A76", width: 16, textAlign: "center", flexShrink: 0 }}>
                      {STATUS_ICON[j.status] ?? "·"}
                    </span>
                    <span style={{ fontSize: 13, color: "#171717", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {j.fileName}
                    </span>
                    <span style={{ fontSize: 12, color: STATUS_COLOR[j.status] ?? "#7A7A76", flexShrink: 0, minWidth: 64, textAlign: "right" }}>
                      {j.status}
                    </span>
                    <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0, minWidth: 60, textAlign: "right" }}>
                      {timeAgo(j.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
