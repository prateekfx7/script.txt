import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/getUserId";

export async function POST(req: NextRequest) {
  try {
    const { fileName, text, segments, language, engine } = await req.json();

    if (!fileName || !text) {
      return NextResponse.json({ error: "fileName and text are required" }, { status: 400 });
    }

    const userId = await getUserIdFromRequest(req);

    const job = await prisma.job.create({
      data: {
        fileName,
        fileUrl: "local://browser",
        sourceType: "upload",
        status: "done",
        userId,
        language: language || null,
        engine: engine || "local",
      },
    });

    await prisma.transcript.create({
      data: {
        jobId: job.id,
        text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segments: (segments || []) as any,
      },
    });

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    console.error("save-local error:", err);
    return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
  }
}
