import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileName: true,
        status: true,
        errorMsg: true,
        createdAt: true,
        sourceType: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("jobs/[id] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
