import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transcribeBuffer } from "@/lib/transcribe";
import { getUserIdFromRequest } from "@/lib/getUserId";

export const maxDuration = 60; // Allow longer execution for audio transcription

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = (formData.get("language") as string | null) || "auto";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "video/mp4";

    // Transcribe with Whisper AI
    const result = await transcribeBuffer(buffer, file.name, contentType, language);

    // Create Job in DB
    const job = await prisma.job.create({
      data: {
        fileName: file.name,
        fileUrl: "direct://upload",
        sourceType: "upload",
        status: "done",
        userId,
        language: language !== "auto" ? language : null,
        engine: "openai",
      },
    });

    // Create Transcript in DB
    await prisma.transcript.create({
      data: {
        jobId: job.id,
        text: result.text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segments: (result.segments || []) as any,
      },
    });

    return NextResponse.json({ jobId: job.id, text: result.text });
  } catch (err: unknown) {
    console.error("transcribe-file API error:", err);
    const msg = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
