import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { transcribeBuffer, isServerTranscribeAvailable } from "@/lib/transcribe";
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

        return NextResponse.json({
          jobId: job.id,
          fileName: finalDisplayName,
          text: fullText,
          segments,
        });
      }

      return NextResponse.json(
        {
          error:
            "This YouTube video has no closed captions enabled on YouTube. Drop the video or audio file directly into the upload box for instant on-device Whisper AI transcription!",
        },
        { status: 422 }
      );
    }

    // ── 2. INSTAGRAM REELS (AUTOMATED DIRECT EXTRACTION & GROQ WHISPER) ──
    if (info.platform === "instagram" && info.id) {
      try {
        const { buffer, fileName, displayName } = await fetchInstagramVideoBuffer(info.id);
        const canTranscribe = await isServerTranscribeAvailable();

        if (!canTranscribe) {
          const safeId = info.id.replace(/[^a-zA-Z0-9_-]/g, "");
          const tempFile = path.join("/tmp", `insta_${safeId}.mp4`);
          fs.writeFileSync(tempFile, buffer);

          return NextResponse.json({
            requiresClientTranscribe: true,
            streamUrl: `/api/get-insta-stream?tempId=insta_${safeId}`,
            fileName: displayName || `instagram_${info.id}.mp4`,
          });
        }

        try {
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

          return NextResponse.json({
            jobId: job.id,
            fileName: displayName || "Instagram Reel",
            text: result.text,
            segments: result.segments,
          });
        } catch (cloudErr) {
          console.warn("Cloud transcription failed for Instagram reel, streaming to client:", cloudErr);
          const safeId = info.id.replace(/[^a-zA-Z0-9_-]/g, "");
          const tempFile = path.join("/tmp", `insta_${safeId}.mp4`);
          fs.writeFileSync(tempFile, buffer);

          return NextResponse.json({
            requiresClientTranscribe: true,
            streamUrl: `/api/get-insta-stream?tempId=insta_${safeId}`,
            fileName: displayName || `instagram_${info.id}.mp4`,
          });
        }
      } catch (igErr) {
        console.warn("Instagram extraction error:", igErr);
        const msg =
          igErr instanceof Error
            ? igErr.message
            : "Could not transcribe Instagram Reel. Please ensure the post is public or drop the file into upload box.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    // ── 3. DIRECT AUDIO/VIDEO, GOOGLE DRIVE, DROPBOX ──
    if (info.directDownloadUrl) {
      const canTranscribe = await isServerTranscribeAvailable();
      if (!canTranscribe) {
        return NextResponse.json({
          requiresClientTranscribe: true,
          streamUrl: `/api/proxy-download?url=${encodeURIComponent(info.directDownloadUrl)}`,
          fileName: info.displayName || "Online Media",
        });
      }

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

        return NextResponse.json({
          jobId: job.id,
          fileName: info.displayName || "Online Media",
          text: result.text,
          segments: result.segments,
        });
      } catch (mediaErr) {
        console.warn("Direct media download failed, falling back to client proxy:", mediaErr);
        return NextResponse.json({
          requiresClientTranscribe: true,
          streamUrl: `/api/proxy-download?url=${encodeURIComponent(info.directDownloadUrl)}`,
          fileName: info.displayName || "Online Media",
        });
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
