import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { processTranscriptionJob } from "@/lib/transcribeJobCore";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    // Delete transcript first (FK constraint)
    await prisma.transcript.deleteMany({ where: { jobId: params.id } });
    await prisma.job.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/jobs/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    await prisma.job.update({
      where: { id: params.id },
      data: { status: "pending", errorMsg: null },
    });

    processTranscriptionJob(params.id).catch((err) =>
      console.error("Admin retry error:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/jobs/[id] POST retry]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
