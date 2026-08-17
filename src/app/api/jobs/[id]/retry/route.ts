import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTranscriptionJob } from "@/lib/transcribeJobCore";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Reset job status to pending and clear error
    await prisma.job.update({
      where: { id: params.id },
      data: { status: "pending", errorMsg: null },
    });

    // Trigger local background execution
    processTranscriptionJob(params.id).catch((err) => {
      console.error("Retry processing error:", err);
    });

    return NextResponse.json({ success: true, jobId: params.id });
  } catch (err) {
    console.error("retry POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
