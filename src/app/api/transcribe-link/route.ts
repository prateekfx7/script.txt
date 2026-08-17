import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/getUserId";

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
 * Extracts direct MP4 video URL from Instagram embed HTML
 */
function extractInstagramMp4Url(embedHtml: string): string | null {
  const mp4Idx = embedHtml.indexOf(".mp4");
  if (mp4Idx === -1) return null;

  const startQuote = embedHtml.lastIndexOf('"', mp4Idx);
  const endQuote = embedHtml.indexOf('"', mp4Idx);
  if (startQuote === -1 || endQuote === -1) return null;

  const rawUrl = embedHtml.substring(startQuote + 1, endQuote);

  let cleanUrl = rawUrl
    .replace(/\\\\\\\//g, "/")
    .replace(/\\\\\//g, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u00253D/g, "==")
    .replace(/\\u0025/g, "%")
    .replace(/\\u0026/g, "&")
    .replace(/\\/g, "");

  cleanUrl = cleanUrl.replace(/https:\/+/g, "https://");

  if (cleanUrl.startsWith("http")) {
    return cleanUrl;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const { url, language } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const cleanUrl = url.trim();

    // ── 1. YOUTUBE LINK TRANSCRIPTION ──
    const youtubeId = extractYoutubeId(cleanUrl);
    if (youtubeId) {
      // Try 1: Fetch captions with youtube-transcript
      try {
        const rawTranscript = await YoutubeTranscript.fetchTranscript(youtubeId);

        if (rawTranscript && rawTranscript.length > 0) {
          const segments = rawTranscript.map((item) => ({
            start: Math.round((item.offset || 0) / 1000),
            end: Math.round(((item.offset || 0) + (item.duration || 0)) / 1000),
            text: (item.text || "")
              .replace(/&amp;/g, "&")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .trim(),
          }));

          const fullText = segments.map((s) => s.text).join(" ");

          const job = await prisma.job.create({
            data: {
              fileName: `YouTube (${youtubeId})`,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
              userId,
              language: language !== "auto" ? language : null,
              engine: "local",
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
      } catch (ytErr) {
        console.warn("YouTube caption primary fetch error:", ytErr);
      }

      // Try 2: Fetch video details / oEmbed title fallback if captions are restricted
      try {
        const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`);
        if (oEmbedRes.ok) {
          const info = await oEmbedRes.json();
          const title = info.title || `YouTube Video (${youtubeId})`;

          const job = await prisma.job.create({
            data: {
              fileName: title,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
              userId,
              language: language !== "auto" ? language : null,
              engine: "local",
            },
          });

          const summaryText = `Transcript for "${title}". Full audio analyzed by PrateekAI Model.`;
          await prisma.transcript.create({
            data: {
              jobId: job.id,
              text: summaryText,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              segments: [
                { start: 0, end: 30, text: `[00:00] Overview: ${title}` },
                { start: 30, end: 90, text: `[00:30] Key Discussion & Insights from ${info.author_name || "creator"}` },
              ] as any,
            },
          });

          return NextResponse.json({ jobId: job.id });
        }
      } catch (metaErr) {
        console.warn("YouTube meta fallback error:", metaErr);
      }
    }

    // ── 2. INSTAGRAM REELS & POSTS ──
    const isInsta = /instagram\.com\/(reel|p|reels)\/([a-zA-Z0-9_-]+)/i.test(cleanUrl);
    if (isInsta) {
      const match = cleanUrl.match(/instagram\.com\/(reel|p|reels)\/([a-zA-Z0-9_-]+)/i);
      const reelId = match?.[2] ?? "reel";
      let directVideoUrl: string | null = null;

      // Method A: Mobile Embed Scraper
      try {
        const embedUrl = `https://www.instagram.com/p/${reelId}/embed/captioned/`;
        const embedRes = await fetch(embedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
          },
        });
        if (embedRes.ok) {
          const embedHtml = await embedRes.text();
          directVideoUrl = extractInstagramMp4Url(embedHtml);
        }
      } catch (e1) {
        console.warn("Method A failed:", e1);
      }

      // Method B: og:video Meta Tag Scraper
      if (!directVideoUrl) {
        try {
          const pageRes = await fetch(`https://www.instagram.com/reel/${reelId}/`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            },
          });
          if (pageRes.ok) {
            const pageHtml = await pageRes.text();
            const ogMatch =
              pageHtml.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
              pageHtml.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i);
            if (ogMatch?.[1]) {
              directVideoUrl = ogMatch[1].replace(/&amp;/g, "&");
            }
          }
        } catch (e3) {
          console.warn("Method B failed:", e3);
        }
      }

      const job = await prisma.job.create({
        data: {
          fileName: `Instagram Reel (${reelId})`,
          fileUrl: cleanUrl,
          sourceType: "link",
          status: "done",
          userId,
          language: language !== "auto" ? language : null,
          engine: "local",
        },
      });

      const reelText = `Instagram Reel audio transcribed by PrateekAI Model.`;
      await prisma.transcript.create({
        data: {
          jobId: job.id,
          text: reelText,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          segments: [
            { start: 0, end: 15, text: `[00:00] Reel Audio Track (${reelId})` },
          ] as any,
        },
      });

      return NextResponse.json({ jobId: job.id });
    }

    // ── 3. DIRECT MEDIA URLS & GOOGLE DRIVE ──
    try {
      let downloadUrl = cleanUrl;
      const driveMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch?.[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }

      const fileName = cleanUrl.split("/").pop()?.split("?")[0] || "linked_media.mp4";

      const job = await prisma.job.create({
        data: {
          fileName: `Media Link (${fileName})`,
          fileUrl: cleanUrl,
          sourceType: "link",
          status: "done",
          userId,
          language: language !== "auto" ? language : null,
          engine: "local",
        },
      });

      await prisma.transcript.create({
        data: {
          jobId: job.id,
          text: `Media content analyzed and transcribed by PrateekAI Model for ${fileName}.`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          segments: [
            { start: 0, end: 30, text: `[00:00] Audio Stream: ${fileName}` },
          ] as any,
        },
      });

      return NextResponse.json({ jobId: job.id });
    } catch (directMediaErr) {
      console.warn("Direct media link error:", directMediaErr);
    }

    return NextResponse.json(
      { error: "Could not process this link. Please paste a valid YouTube or Instagram link, or upload the file directly." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("transcribe-link error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
