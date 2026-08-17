import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const exportCsv = searchParams.get("export") === "csv";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const q = searchParams.get("q")?.trim() ?? "";
  const pageSize = 50;

  try {
    const where = {
      ...(status && status !== "all" ? { status } : {}),
      ...(q ? { fileName: { contains: q, mode: "insensitive" as const } } : {}),
    };


    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: exportCsv ? 10000 : pageSize,
        skip: exportCsv ? 0 : (page - 1) * pageSize,
        include: {
          transcript: {
            select: { id: true, text: true },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    if (exportCsv) {
      const header = "id,fileName,sourceType,status,errorMsg,createdAt,transcriptLength\n";
      const rows = jobs
        .map((j) =>
          [
            j.id,
            `"${j.fileName.replace(/"/g, '""')}"`,
            j.sourceType,
            j.status,
            `"${(j.errorMsg ?? "").replace(/"/g, '""')}"`,
            j.createdAt.toISOString(),
            j.transcript?.text?.length ?? 0,
          ].join(",")
        )
        .join("\n");

      return new NextResponse(header + rows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="jobs-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        fileName: j.fileName,
        sourceType: j.sourceType,
        status: j.status,
        errorMsg: j.errorMsg,
        createdAt: j.createdAt,
        transcriptPreview: j.transcript?.text?.slice(0, 200) ?? null,
        transcriptId: j.transcript?.id ?? null,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("[admin/jobs GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
