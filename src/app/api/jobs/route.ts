import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { processTranscriptionJob } from "@/lib/transcribeJobCore";

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileUrl, sourceType } = await req.json();

    if (!fileName || !fileUrl || !sourceType) {
      return NextResponse.json(
        { error: "fileName, fileUrl, and sourceType are required" },
        { status: 400 }
      );
    }

    // Create a pending job in the database
    const job = await prisma.job.create({
      data: {
        fileName,
        fileUrl,
        sourceType,
        status: "pending",
      },
    });

    // Enqueue in Inngest (if Inngest dev server is running)
    inngest.send({
      name: "job/transcribe",
      data: { jobId: job.id },
    }).catch((err) => {
      console.warn("Inngest enqueue warning (non-fatal):", err);
    });

    // Trigger local background execution asynchronously (non-blocking fallback)
    processTranscriptionJob(job.id).catch((err) => {
      console.error("Local job processing error:", err);
    });

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (err) {
    console.error("jobs POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
