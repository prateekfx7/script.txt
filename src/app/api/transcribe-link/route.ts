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
  fetchYoutubeAudioBuffer,
  fetchGenericMediaAudioBuffer,
} from "@/lib/linkMediaService";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { url, language } = body;

    console.log(`[transcribe-link] Incoming URL: "${url}", language: "${language}"`);

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

      // Fallback: If YouTube has no native closed captions, extract audio & transcribe with Whisper!
      try {
        const { buffer, fileName } = await fetchYoutubeAudioBuffer(info.id);
        const result = await transcribeBuffer(buffer, fileName, "audio/mpeg", language);
        const finalDisplayName = authorName || `YouTube Video`;

        const job = await prisma.job.create({
          data: {
            fileName: finalDisplayName,
            fileUrl: info.cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language && language !== "auto" ? language : null,
            engine: "openai-whisper",
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
          fileName: finalDisplayName,
          text: result.text,
          segments: result.segments,
        });
      } catch (whisperErr: unknown) {
        console.warn("YouTube Whisper transcription fallback failed:", whisperErr);
        const msg =
          whisperErr instanceof Error
            ? whisperErr.message
            : "Could not transcribe this YouTube video. Please ensure the video is public or drop the file directly into upload.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    // ── 2. INSTAGRAM REELS (AUTOMATED DIRECT EXTRACTION & GROQ/LOCAL WHISPER) ──
    if (info.platform === "instagram" && info.id) {
      try {
        const { buffer, fileName, displayName } = await fetchInstagramVideoBuffer(info.id, info.cleanUrl);
        const canTranscribe = await isServerTranscribeAvailable();

        if (!canTranscribe) {
          const safeId = info.id.replace(/[^a-zA-Z0-9_-]/g, "");
          const ext = fileName.endsWith(".mp3") ? "mp3" : "mp4";
          const tempFile = path.join("/tmp", `insta_${safeId}.${ext}`);
          fs.writeFileSync(tempFile, buffer);

          return NextResponse.json({
            requiresClientTranscribe: true,
            streamUrl: `/api/get-insta-stream?tempId=insta_${safeId}`,
            fileName: displayName || `instagram_${info.id}.${ext}`,
          });
        }

        try {
          const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg" : "video/mp4";
          const result = await transcribeBuffer(buffer, fileName, mimeType, language);

          const job = await prisma.job.create({
            data: {
              fileName: displayName || `Instagram Reel`,
              fileUrl: info.cleanUrl,
              sourceType: "link",
              status: "done",
              userId,
              language: language && language !== "auto" ? language : null,
              engine: process.env.WHISPER_ENGINE || "openai-whisper",
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
        } catch (whisperErr) {
          console.warn("Instagram Whisper transcription error:", whisperErr);
          throw whisperErr;
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

    // ── 3. DIRECT AUDIO/VIDEO, GOOGLE DRIVE, DROPBOX, & GENERIC MEDIA ──
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
            engine: process.env.WHISPER_ENGINE || "openai-whisper",
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
        console.warn("Direct media download failed, attempting yt-dlp extractor fallback:", mediaErr);
        try {
          const { buffer, fileName, displayName } = await fetchGenericMediaAudioBuffer(info.cleanUrl);
          const result = await transcribeBuffer(buffer, fileName, "audio/mpeg", language);

          const job = await prisma.job.create({
            data: {
              fileName: displayName || info.displayName || "Online Media",
              fileUrl: info.cleanUrl,
              sourceType: "link",
              status: "done",
              userId,
              language: language && language !== "auto" ? language : null,
              engine: process.env.WHISPER_ENGINE || "openai-whisper",
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
            fileName: displayName || info.displayName || "Online Media",
            text: result.text,
            segments: result.segments,
          });
        } catch {
          return NextResponse.json({
            requiresClientTranscribe: true,
            streamUrl: `/api/proxy-download?url=${encodeURIComponent(info.directDownloadUrl)}`,
            fileName: info.displayName || "Online Media",
          });
        }
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
