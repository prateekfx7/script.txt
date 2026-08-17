import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/getUserId";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const language = searchParams.get("language") || "";
  const sort = searchParams.get("sort") || "newest";
  const starredOnly = searchParams.get("starred") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId,
    status: "done",
  };

  if (search) {
    where.fileName = { contains: search, mode: "insensitive" };
  }
  if (language) {
    where.language = language;
  }
  if (starredOnly) {
    where.starred = true;
  }

  const jobs = await prisma.job.findMany({
    where,
    include: {
      transcript: {
        select: { text: true, segments: true },
      },
    },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: 100,
  });

  const transcripts = jobs.map((job) => {
    const segments = (job.transcript?.segments as unknown as Array<{ start: number; end: number; text: string }>) || [];
    const lastSeg = segments[segments.length - 1];
    const durationSecs = lastSeg ? Math.ceil(lastSeg.end) : 0;

    return {
      jobId: job.id,
      fileName: job.fileName,
      language: job.language,
      engine: job.engine,
      starred: job.starred,
      createdAt: job.createdAt.toISOString(),
      sourceType: job.sourceType,
      textPreview: (job.transcript?.text || "").slice(0, 120),
      segmentCount: segments.length,
      durationSecs,
    };
  });

  return NextResponse.json({ transcripts });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, starred } = await req.json();
  if (!jobId || typeof starred !== "boolean") {
    return NextResponse.json({ error: "jobId and starred (boolean) required" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  await prisma.job.update({ where: { id: jobId }, data: { starred } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await req.json();
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  // Delete transcript first (foreign key), then job
  await prisma.transcript.deleteMany({ where: { jobId } });
  await prisma.job.delete({ where: { id: jobId } });

  return NextResponse.json({ ok: true });
}
