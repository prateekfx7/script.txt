import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { getSubtitles } from "youtube-caption-extractor";
import { prisma } from "@/lib/prisma";
import { transcribeBuffer } from "@/lib/transcribe";
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
 * Multi-strategy YouTube transcript fetcher (tries YouTubeTranscript, then getSubtitles with language, then getSubtitles auto)
 */
async function fetchYoutubeCaptions(youtubeId: string, language?: string) {
  // Method 1: youtube-transcript
  try {
    const raw = await YoutubeTranscript.fetchTranscript(youtubeId, {
      lang: language && language !== "auto" ? language : undefined,
    });
    if (raw && raw.length > 0) {
      return raw.map((item) => ({
        start: Math.round((item.offset || 0) / 1000),
        end: Math.round(((item.offset || 0) + (item.duration || 0)) / 1000),
        text: (item.text || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
      }));
    }
  } catch (e1) {
    // try next
  }

  // Method 2: youtube-caption-extractor with targeted language
  try {
    const raw = await getSubtitles({
      videoID: youtubeId,
      lang: language && language !== "auto" ? language : "en",
    });
    if (raw && raw.length > 0) {
      return raw.map((item) => {
        const start = parseFloat(item.start) || 0;
        const dur = parseFloat(item.dur) || 0;
        return {
          start: Math.round(start),
          end: Math.round(start + dur),
          text: (item.text || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
        };
      });
    }
  } catch (e2) {
    // try next
  }

  // Method 3: youtube-caption-extractor default
  try {
    const raw = await getSubtitles({ videoID: youtubeId });
    if (raw && raw.length > 0) {
      return raw.map((item) => {
        const start = parseFloat(item.start) || 0;
        const dur = parseFloat(item.dur) || 0;
        return {
          start: Math.round(start),
          end: Math.round(start + dur),
          text: (item.text || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
        };
      });
    }
  } catch (e3) {
    // all caption extractors failed
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
    const userId = await getUserIdFromRequest(req);
    const { url, language } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // ── 1. YOUTUBE LINK TRANSCRIPTION ──
    const youtubeId = extractYoutubeId(cleanUrl);
    if (youtubeId) {
      const segments = await fetchYoutubeCaptions(youtubeId, language);

      if (segments && segments.length > 0) {
        const fullText = segments.map((s) => s.text).join(" ");

        const job = await prisma.job.create({
          data: {
            fileName: `YouTube (${youtubeId})`,
            fileUrl: cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language !== "auto" ? language : null,
            engine: "openai",
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

      // If YouTube has zero captions on all methods
      return NextResponse.json(
        {
          error:
            "Could not retrieve captions for this YouTube video (captions are unavailable or disabled). Drop the video/audio file into the upload box for instant transcription.",
        },
        { status: 422 }
      );
    }

    // ── 2. INSTAGRAM REELS & POSTS (MULTI-LAYER RESOLVER PIPELINE) ──
    const isInsta = /instagram\.com\/(reel|p|reels|tv)\/([a-zA-Z0-9_-]+)/i.test(cleanUrl);
    if (isInsta) {
      const match = cleanUrl.match(/instagram\.com\/(reel|p|reels|tv)\/([a-zA-Z0-9_-]+)/i);
      const reelId = match?.[2] ?? "reel";
      let videoBuffer: Buffer | null = null;
      const sessionId = process.env.INSTAGRAM_SESSION_ID;

      // ── Method 1: Instagram GraphQL / Web API (with Session Cookie if provided) ──
      try {
        const headers: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "X-IG-App-ID": "936619743392459",
          "Sec-Fetch-Site": "same-origin",
        };
        if (sessionId) {
          headers["Cookie"] = `sessionid=${sessionId};`;
        }

        const apiRes = await fetch(`https://www.instagram.com/p/${reelId}/?__a=1&__d=dis`, {
          headers,
        });

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const directUrl =
            apiData?.items?.[0]?.video_versions?.[0]?.url ||
            apiData?.graphql?.shortcode_media?.video_url ||
            apiData?.items?.[0]?.carousel_media?.[0]?.video_versions?.[0]?.url;

          if (directUrl) {
            const vRes = await fetch(directUrl, { headers: { Referer: "https://www.instagram.com/" } });
            if (vRes.ok) {
              videoBuffer = Buffer.from(await vRes.arrayBuffer());
            }
          }
        }
      } catch (e1) {
        console.warn("Instagram Web API method failed:", e1);
      }

      // ── Method 2: Mobile Embed Scraper ──
      if (!videoBuffer) {
        try {
          const embedRes = await fetch(`https://www.instagram.com/p/${reelId}/embed/captioned/`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            },
          });
          if (embedRes.ok) {
            const embedHtml = await embedRes.text();
            const directUrl = extractInstagramMp4Url(embedHtml);
            if (directUrl) {
              const vRes = await fetch(directUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  Referer: "https://www.instagram.com/",
                },
              });
              if (vRes.ok) {
                videoBuffer = Buffer.from(await vRes.arrayBuffer());
              }
            }
          }
        } catch (e2) {
          console.warn("Instagram Embed scraper failed:", e2);
        }
      }

      // ── Method 3: Multi-Node Public Media Resolvers (Cobalt instances) ──
      if (!videoBuffer) {
        const resolverNodes = [
          "https://api.cobalt.tools",
          "https://cobalt-api.kwiatekm.pl",
          "https://co.wuk.sh/api/json",
          "https://cobalt.tools/api/json",
        ];

        for (const node of resolverNodes) {
          try {
            const cobRes = await fetch(node, {
              method: "POST",
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: cleanUrl,
                audioOnly: false,
              }),
            });

            if (cobRes.ok) {
              const cobData = await cobRes.json();
              const targetUrl = cobData.url || cobData.audio || cobData.stream;
              if (targetUrl) {
                const streamRes = await fetch(targetUrl);
                if (streamRes.ok) {
                  videoBuffer = Buffer.from(await streamRes.arrayBuffer());
                  if (videoBuffer && videoBuffer.byteLength > 1000) break;
                }
              }
            }
          } catch {
            // Try next resolver node seamlessly
          }
        }
      }

      // ── Method 4: Open og:video Scraper ──
      if (!videoBuffer) {
        try {
          const pageRes = await fetch(`https://www.instagram.com/reel/${reelId}/`, {
            headers: {
              "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
            },
          });
          if (pageRes.ok) {
            const pageHtml = await pageRes.text();
            const ogMatch =
              pageHtml.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
              pageHtml.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i);
            if (ogMatch?.[1]) {
              const ogUrl = ogMatch[1].replace(/&amp;/g, "&");
              const vRes = await fetch(ogUrl);
              if (vRes.ok) {
                videoBuffer = Buffer.from(await vRes.arrayBuffer());
              }
            }
          }
        } catch (e4) {
          console.warn("Instagram OpenGraph scraper failed:", e4);
        }
      }

      // ── If successfully retrieved video buffer: Transcribe it! ──
      if (videoBuffer && videoBuffer.byteLength > 500) {
        // Transcribe audio using Whisper AI
        const result = await transcribeBuffer(videoBuffer, `instagram_${reelId}.mp4`, "video/mp4", language);

        // Save Job + Transcript to DB
        const job = await prisma.job.create({
          data: {
            fileName: `Instagram Reel (${reelId})`,
            fileUrl: cleanUrl,
            sourceType: "link",
            status: "done",
            userId,
            language: language !== "auto" ? language : null,
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
      }

      return NextResponse.json(
        {
          error:
            `Instagram Reel (${reelId}) is restricted or login-walled by Meta. Please download the MP4 using a reel saver and drag-and-drop the file to transcribe instantly!`,
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

          const result = await transcribeBuffer(videoBuffer, fileName, contentType, language);

          const job = await prisma.job.create({
            data: {
              fileName: `Media Link (${fileName})`,
              fileUrl: cleanUrl,
              sourceType: "link",
              status: "done",
              userId,
              language: language !== "auto" ? language : null,
              engine: "openai",
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
