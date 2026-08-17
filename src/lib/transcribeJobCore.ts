import { prisma } from "@/lib/prisma";
import { transcribeBuffer } from "@/lib/transcribe";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { YoutubeTranscript } from "youtube-transcript";

/**
 * Parses YouTube Video ID from various link formats
 */
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Core transcription runner for uploaded files and external media links.
 * Updates Job status: pending -> processing -> done (or failed with errorMsg).
 */
export async function processTranscriptionJob(jobId: string) {
  try {
    // 1. Mark job as processing
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status === "processing" || job.status === "done") {
      return;
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "processing" },
    });

    // ── 2. HANDLE "LINK" SOURCE TYPES (HappyScribe architecture) ──
    if (job.sourceType === "link") {
      const cleanUrl = job.fileUrl.trim();

      // a. YouTube native caption fetch
      const youtubeId = extractYoutubeId(cleanUrl);
      if (youtubeId) {
        try {
          const rawTranscript = await YoutubeTranscript.fetchTranscript(youtubeId);
          if (rawTranscript && rawTranscript.length > 0) {
            const segments = rawTranscript.map((item) => ({
              start: Math.round((item.offset || 0) / 1000),
              end: Math.round(((item.offset || 0) + (item.duration || 0)) / 1000),
              text: (item.text || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
            }));
            const fullText = segments.map((s) => s.text).join(" ");

            await prisma.transcript.create({
              data: { jobId, text: fullText, segments },
            });
            await prisma.job.update({
              where: { id: jobId },
              data: { status: "done" },
            });
            return;
          }
        } catch (ytErr) {
          console.warn("YouTube caption fetch in job core failed:", ytErr);
        }
      }

      // b. Google Drive direct download link conversion
      let downloadUrl = cleanUrl;
      const driveMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch?.[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }

      // c. Download media file buffer from link
      const res = await fetch(downloadUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) {
        throw new Error(`Could not access link media (${res.status} ${res.statusText}).`);
      }

      const arrayBuf = await res.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuf);
      const contentType = res.headers.get("content-type") || "video/mp4";

      const result = await transcribeBuffer(fileBuffer, job.fileName, contentType);

      await prisma.transcript.create({
        data: { jobId, text: result.text, segments: (result.segments || []) as any },
      });

      await prisma.job.update({
        where: { id: jobId },
        data: { status: "done" },
      });

      return;
    }

    // ── 3. HANDLE FILE UPLOADS (SUPABASE STORAGE) ──
    let fileBuffer: Buffer;
    
    let storagePath = "";
    if (job.fileUrl.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`)) {
      storagePath = job.fileUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1];
    } else if (job.fileUrl.includes(`/storage/v1/object/authenticated/${STORAGE_BUCKET}/`)) {
      storagePath = job.fileUrl.split(`/storage/v1/object/authenticated/${STORAGE_BUCKET}/`)[1];
    }

    if (storagePath) {
      const { data: blob, error: downloadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (downloadErr || !blob) {
        const { data: signedData } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 300);

        const targetUrl = signedData?.signedUrl || job.fileUrl;
        const res = await fetch(targetUrl);
        if (!res.ok) {
          throw new Error(`Failed to download file from storage (${res.status} ${res.statusText}).`);
        }
        const ab = await res.arrayBuffer();
        fileBuffer = Buffer.from(ab);
      } else {
        const ab = await blob.arrayBuffer();
        fileBuffer = Buffer.from(ab);
      }
    } else {
      const res = await fetch(job.fileUrl);
      if (!res.ok) {
        throw new Error(`Failed to download file from storage (${res.status} ${res.statusText}).`);
      }
      const ab = await res.arrayBuffer();
      fileBuffer = Buffer.from(ab);
    }

    // 4. Detect MIME type
    const ext = job.fileName.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac",
    };
    const mimeType = mimeMap[ext ?? ""] ?? "application/octet-stream";

    // 5. Transcribe using Whisper AI
    const result = await transcribeBuffer(fileBuffer, job.fileName, mimeType);

    // 6. Save transcript and mark job done
    await prisma.transcript.create({
      data: {
        jobId,
        text: result.text,
        segments: (result.segments || []) as any,
      },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "done" },
    });
  } catch (err: unknown) {
    console.error(`Transcription error for job ${jobId}:`, err);
    const errorMsg = err instanceof Error ? err.message : "Transcription failed";
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMsg,
      },
    }).catch(() => {});
  }
}
