import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transcribeBuffer } from "@/lib/transcribe";
import { getUserIdFromRequest } from "@/lib/getUserId";
import {
  parseMediaLink,
  extractYoutubeTranscript,
  fetchYoutubeAuthor,
  fetchInstagramVideoBuffer,
  downloadDirectMedia,
} from "@/lib/linkMediaService";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { url, language } = body;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Please enter a valid URL." }, { status: 400 });
    }

    const info = parseMediaLink(url);

    // ── 1. YOUTUBE TRANSCRIPTION (INSTANT NATIVE CAPTIONS) ──
    if (info.platform === "youtube" && info.id) {
      const [segments, authorName] = await Promise.all([
        extractYoutubeTranscript(info.id, language),
        fetchYoutubeAuthor(info.id),
      ]);

      if (segments && segments.length > 0) {
        const fullText = segments.map((s) => s.text).join(" ");
        const finalDisplayName = authorName || `YouTube Video`;

        const job = await prisma.job.create({
          data: {
            fileName: finalDisplayName,
            fileUrl: info.cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language && language !== "auto" ? language : null,
            engine: "openai",
          },
        });

        await prisma.transcript.create({
          data: {
            jobId: job.id,
            text: fullText,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            segments: segments as any,
          },
        });

        return NextResponse.json({ jobId: job.id });
      }

      return NextResponse.json(
        {
          error:
            "This YouTube video has no closed captions enabled. Drop the video or audio file directly into the upload box for instant Whisper AI transcription!",
        },
        { status: 422 }
      );
    }

    // ── 2. INSTAGRAM REELS (AUTOMATED DIRECT EXTRACTION & GROQ WHISPER) ──
    if (info.platform === "instagram" && info.id) {
      try {
        const { buffer, fileName, displayName } = await fetchInstagramVideoBuffer(info.id);
        const result = await transcribeBuffer(buffer, fileName, "video/mp4", language);

        const job = await prisma.job.create({
          data: {
            fileName: displayName || `Instagram Reel`,
            fileUrl: info.cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language && language !== "auto" ? language : null,
            engine: "openai",
          },
        });

        await prisma.transcript.create({
          data: {
            jobId: job.id,
            text: result.text,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            segments: (result.segments || []) as any,
          },
        });

        return NextResponse.json({ jobId: job.id });
      } catch (igErr) {
        console.warn("Instagram extraction error:", igErr);
        const msg =
          igErr instanceof Error
            ? igErr.message
            : "Could not transcribe Instagram Reel. Please ensure the post is public.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    // ── 3. DIRECT AUDIO/VIDEO, GOOGLE DRIVE, DROPBOX ──
    if (info.directDownloadUrl) {
      try {
        const { buffer, mimeType, fileName } = await downloadDirectMedia(info.directDownloadUrl);
        const result = await transcribeBuffer(buffer, fileName, mimeType, language);

        const job = await prisma.job.create({
          data: {
            fileName: `${info.displayName}`,
            fileUrl: info.cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language && language !== "auto" ? language : null,
            engine: "openai",
          },
        });

        await prisma.transcript.create({
          data: {
            jobId: job.id,
            text: result.text,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            segments: (result.segments || []) as any,
          },
        });

        return NextResponse.json({ jobId: job.id });
      } catch (mediaErr) {
        console.warn("Direct media download failed:", mediaErr);
        const msg = mediaErr instanceof Error ? mediaErr.message : "Could not download file from link.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    return NextResponse.json(
      {
        error:
          "Please paste a valid YouTube video link, Instagram Reel link, Google Drive link, or direct audio/video URL.",
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("transcribe-link error:", err);
    const msg = err instanceof Error ? err.message : "Something went wrong processing link.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
