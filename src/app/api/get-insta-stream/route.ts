import { NextRequest, NextResponse } from "next/server";

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
    const match = cleanUrl.match(/instagram\.com\/(reel|p|reels)\/([a-zA-Z0-9_-]+)/i);
    const shortcode = match?.[2];

    if (!shortcode) {
      return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
    }

    let directVideoUrl: string | null = null;

    // ── METHOD 1: Mobile Embed Scraper ──
    try {
      const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
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
    } catch (m1Err) {
      console.warn("Method 1 embed scraper failed:", m1Err);
    }

    // ── METHOD 2: Web API Header Scraper (X-IG-App-ID) ──
    if (!directVideoUrl) {
      try {
        const apiRes = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
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
      } catch (m2Err) {
        console.warn("Method 2 Web API scraper failed:", m2Err);
      }
    }

    // ── METHOD 3: og:video meta scraper ──
    if (!directVideoUrl) {
      try {
        const pageRes = await fetch(`https://www.instagram.com/reel/${shortcode}/`, {
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
      } catch (m3Err) {
        console.warn("Method 3 og:video scraper failed:", m3Err);
      }
    }

    if (!directVideoUrl) {
      return NextResponse.json(
        {
          error:
            `This Instagram link (${shortcode}) is a photo/carousel post or private Reel with no video audio stream. Please paste a link to an Instagram Video Reel!`,
        },
        { status: 422 }
      );
    }

    // Stream raw video bytes directly to browser for Local AI processing
    const videoRes = await fetch(directVideoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
      },
    });

    if (!videoRes.ok) {
      return NextResponse.json(
        { error: `Instagram video server returned HTTP ${videoRes.status}` },
        { status: videoRes.status }
      );
    }

    const arrayBuffer = await videoRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    console.error("get-insta-stream error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Instagram video stream" },
      { status: 500 }
    );
  }
}
