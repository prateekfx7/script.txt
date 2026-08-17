import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTxt, toSrt, toVtt, Segment } from "@/lib/export";

const ALLOWED_FORMATS = ["txt", "srt", "vtt"] as const;
type ExportFormat = (typeof ALLOWED_FORMATS)[number];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const format = req.nextUrl.searchParams.get("format") as ExportFormat | null;

  if (!format || !ALLOWED_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Invalid format. Allowed: ${ALLOWED_FORMATS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const transcript = await prisma.transcript.findUnique({
      where: { jobId: params.id },
      include: { job: { select: { fileName: true } } },
    });

    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    const segments = transcript.segments as Segment[];
    const baseName = transcript.job.fileName.replace(/\.[^/.]+$/, "") || "transcript";

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case "txt":
        content = toTxt(transcript.text);
        mimeType = "text/plain; charset=utf-8";
        extension = "txt";
        break;
      case "srt":
        content = toSrt(segments);
        mimeType = "text/plain; charset=utf-8";
        extension = "srt";
        break;
      case "vtt":
        content = toVtt(segments);
        mimeType = "text/vtt; charset=utf-8";
        extension = "vtt";
        break;
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${baseName}.${extension}"`,
      },
    });
  } catch (err) {
    console.error("export route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
