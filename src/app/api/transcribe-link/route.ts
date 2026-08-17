import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { prisma } from "@/lib/prisma";
import { transcribeBuffer } from "@/lib/transcribe";

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
 * Extracts raw direct .mp4 video URL from Instagram embed HTML using precise unescaping.
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
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const cleanUrl = url.trim();

    // ── 1. YOUTUBE LINK TRANSCRIPTION ──
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

          const job = await prisma.job.create({
            data: {
              fileName: `YouTube (${youtubeId})`,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
            },
          });

          await prisma.transcript.create({
            data: {
              jobId: job.id,
              text: fullText,
              segments,
            },
          });

          return NextResponse.json({ jobId: job.id });
        }
      } catch (ytErr) {
        console.warn("YouTube caption fetch error:", ytErr);
      }
    }

    // ── 2. INSTAGRAM REELS & POSTS (3-METHOD SCRAPER PIPELINE) ──
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

      // Method B: Web API Header Scraper (X-IG-App-ID)
      if (!directVideoUrl) {
        try {
          const apiRes = await fetch(`https://www.instagram.com/p/${reelId}/?__a=1&__d=dis`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "X-IG-App-ID": "936619743392459",
            },
          });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            directVideoUrl =
              apiData?.items?.[0]?.video_versions?.[0]?.url ||
              apiData?.graphql?.shortcode_media?.video_url ||
              null;
          }
        } catch (e2) {
          console.warn("Method B failed:", e2);
        }
      }

      // Method C: og:video Meta Tag Scraper
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
          console.warn("Method C failed:", e3);
        }
      }

      if (directVideoUrl) {
        const videoRes = await fetch(directVideoUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://www.instagram.com/",
          },
        });

        if (videoRes.ok) {
          const arrayBuf = await videoRes.arrayBuffer();
          const videoBuffer = Buffer.from(arrayBuf);

          // Transcribe audio using Whisper AI
          const result = await transcribeBuffer(videoBuffer, `instagram_${reelId}.mp4`, "video/mp4");

          // Save Job + Transcript to DB
          const job = await prisma.job.create({
            data: {
              fileName: `Instagram Reel (${reelId})`,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
            },
          });

          await prisma.transcript.create({
            data: {
              jobId: job.id,
              text: result.text,
              segments: (result.segments || []) as any,
            },
          });

          return NextResponse.json({ jobId: job.id });
        }
      }

      return NextResponse.json(
        {
          error:
            `Instagram link (${reelId}) is private or login-restricted on Instagram. Download the MP4 video and drop the file into the upload box!`,
        },
        { status: 422 }
      );
    }

    // ── 3. DIRECT MEDIA URLS & GOOGLE DRIVE ──
    try {
      let downloadUrl = cleanUrl;
      const driveMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch?.[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }

      const mediaRes = await fetch(downloadUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (mediaRes.ok) {
        const arrayBuf = await mediaRes.arrayBuffer();
        if (arrayBuf.byteLength > 100) {
          const videoBuffer = Buffer.from(arrayBuf);
          const fileName = cleanUrl.split("/").pop()?.split("?")[0] || "linked_media.mp4";
          const contentType = mediaRes.headers.get("content-type") || "video/mp4";

          const result = await transcribeBuffer(videoBuffer, fileName, contentType);

          const job = await prisma.job.create({
            data: {
              fileName: `Media Link (${fileName})`,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
            },
          });

          await prisma.transcript.create({
            data: {
              jobId: job.id,
              text: result.text,
              segments: (result.segments || []) as any,
            },
          });

          return NextResponse.json({ jobId: job.id });
        }
      }
    } catch (directMediaErr) {
      console.warn("Direct media link error:", directMediaErr);
    }

    return NextResponse.json(
      { error: "Please enter a valid YouTube link, Instagram Reel link, Google Drive file link, or direct MP4/MP3 URL." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("transcribe-link error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
