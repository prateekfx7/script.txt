import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/getUserId";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalCount, weekCount, monthCount, allJobs] = await Promise.all([
    prisma.job.count({ where: { userId, status: "done" } }),
    prisma.job.count({ where: { userId, status: "done", createdAt: { gte: startOfWeek } } }),
    prisma.job.count({ where: { userId, status: "done", createdAt: { gte: startOfMonth } } }),
    prisma.job.findMany({
      where: { userId, status: "done" },
      select: {
        language: true,
        engine: true,
        transcript: { select: { segments: true } },
      },
    }),
  ]);

  // Calculate total duration and breakdowns
  let totalDurationSecs = 0;
  const langBreakdown: Record<string, number> = {};
  const engineBreakdown: Record<string, number> = { local: 0, openai: 0 };

  for (const job of allJobs) {
    const segments = (job.transcript?.segments as unknown as Array<{ start: number; end: number }>) || [];
    const lastSeg = segments[segments.length - 1];
    if (lastSeg) totalDurationSecs += Math.ceil(lastSeg.end);

    const lang = job.language || "auto";
    langBreakdown[lang] = (langBreakdown[lang] || 0) + 1;

    const eng = job.engine || "local";
    if (eng in engineBreakdown) engineBreakdown[eng]++;
  }

  return NextResponse.json({
    totalCount,
    weekCount,
    monthCount,
    totalDurationMins: Math.round(totalDurationSecs / 60),
    langBreakdown,
    engineBreakdown,
  });
}
