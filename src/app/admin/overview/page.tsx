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
  return (
    <div className="font-sfpro">
      <h1 className="text-[24px] font-bold text-ink mb-1 tracking-tight">Overview</h1>
      <p className="text-[14px] text-text-gray-2 mb-8">Platform health at a glance</p>

      {loading ? <p className="text-[14px] text-text-gray-2 animate-pulse">Loading…</p> : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-10">
            {[
              { label: "Users", value: stats?.totalUsers ?? 0 },
              { label: "Total Jobs", value: stats?.totalJobs ?? 0 },
              { label: "Done", value: stats?.statusMap?.done ?? 0, color: "text-green" },
              { label: "Failed", value: stats?.statusMap?.failed ?? 0, color: "text-red-500" },
              { label: "Pending", value: stats?.statusMap?.pending ?? 0, color: "text-orange-500" },
              { label: "Processing", value: stats?.statusMap?.processing ?? 0, color: "text-blue-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-[14px] p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <p className="text-[11px] text-text-gray-2 font-bold tracking-wider uppercase mb-2">{s.label}</p>
                <p className={`text-[32px] font-bold leading-none ${s.color ?? "text-ink"}`}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <p className="text-[12px] font-bold text-text-gray-2 tracking-wider uppercase mb-6">Jobs — last 7 days</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats?.jobsByDay ?? []}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ background: "#fff", border: "none", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", fontSize: 13, fontWeight: 500 }} labelFormatter={(v) => fmtDay(v as string)} />
                  <Line type="monotone" dataKey="count" stroke="#3222DD" strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: "#3222DD", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#3222DD", stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <p className="text-[12px] font-bold text-text-gray-2 tracking-wider uppercase mb-6">New Users — last 7 days</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats?.usersByDay ?? []} barSize={32}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ background: "#fff", border: "none", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", fontSize: 13, fontWeight: 500 }} labelFormatter={(v) => fmtDay(v as string)} />
                  <Bar dataKey="count" fill="#171717" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity feed */}
          <div>
            <p className="text-[14px] font-bold text-ink mb-3 tracking-tight">Recent Activity</p>
            <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden">
              {recent.length === 0 ? (
                <p className="p-6 text-text-gray-2 text-[14px]">No recent jobs.</p>
              ) : (
                recent.map((j, i) => (
                  <div key={j.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${i < recent.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <span className="text-[14px] w-5 text-center shrink-0" style={{ color: STATUS_COLOR[j.status] ?? "#7A7A76" }}>
                      {STATUS_ICON[j.status] ?? "·"}
                    </span>
                    <span className="text-[14px] font-medium text-ink flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {j.fileName}
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-wider shrink-0 min-w-[72px] text-right" style={{ color: STATUS_COLOR[j.status] ?? "#7A7A76" }}>
                      {j.status}
                    </span>
                    <span className="text-[12px] text-gray-400 shrink-0 min-w-[64px] text-right font-medium">
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
