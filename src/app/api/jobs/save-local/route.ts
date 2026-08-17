import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { fileName, text, segments } = await req.json();

    if (!fileName || !text) {
      return NextResponse.json({ error: "fileName and text are required" }, { status: 400 });
    }

    // Create completed Job
    const job = await prisma.job.create({
      data: {
        fileName,
        fileUrl: "local://browser",
        sourceType: "upload",
        status: "done",
      },
    });

    // Save Transcript
    await prisma.transcript.create({
      data: {
        jobId: job.id,
        text,
        segments: segments || [{ start: 0, end: 0, text }],
      },
    });

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (err) {
    console.error("save-local job error:", err);
    return NextResponse.json({ error: "Failed to save local transcript" }, { status: 500 });
  }
}
