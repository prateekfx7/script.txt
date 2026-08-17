import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    // ── Job stats ──────────────────────────────────────────────────────────────
    const totalJobs = await prisma.job.count();
    const jobsByStatus = await prisma.job.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    // Jobs per day — last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentJobs = await prisma.job.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    const jobsByDay = buildDailyBuckets(recentJobs.map((j) => j.createdAt));

    // ── User stats (Supabase auth) ─────────────────────────────────────────────
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const totalUsers = usersData?.users?.length ?? 0;

    // New users per day — last 7 days
    const recentUsers = (usersData?.users ?? []).filter(
      (u) => new Date(u.created_at) >= sevenDaysAgo
    );
    const usersByDay = buildDailyBuckets(recentUsers.map((u) => new Date(u.created_at)));

    // ── Status map ─────────────────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const g of jobsByStatus) {
      statusMap[g.status] = g._count.status;
    }

    return NextResponse.json({
      totalJobs,
      totalUsers,
      activeSubscribers: 0, // populated when subscriptions table exists
      statusMap,
      jobsByDay,
      usersByDay,
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDailyBuckets(dates: Date[]): { date: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[fmtDate(d)] = 0;
  }
  for (const d of dates) {
    const key = fmtDate(d);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
