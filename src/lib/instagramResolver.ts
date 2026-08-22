
/**
 * lib/instagramResolver.ts
 *
 * Multi-strategy Instagram video extractor to fetch direct MP4 video buffer
 * from Instagram Reels and Posts without requiring user cookies.
 */

export async function fetchInstagramVideoBuffer(reelId: string, fullUrl: string): Promise<Buffer | null> {
  const cleanReelUrl = `https://www.instagram.com/reel/${reelId}/`;

  // ── Strategy 1: High-Performance Media Resolution API (Downloadgram) ──
  try {
    const res = await fetch(`https://api.downloadgram.org/media?url=${encodeURIComponent(cleanReelUrl)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://downloadgram.org/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const text = await res.text();
      const rawLinks = text.match(/https?:\/\/[^\s"'<>\\]+/g) || [];

      // Find the MP4 video link
      const videoLink =
        rawLinks.find((l) => l.toLowerCase().includes(".mp4") || l.includes("video")) ||
        rawLinks[1] ||
        rawLinks[0];

      if (videoLink) {
        const cleanLink = videoLink.replace(/\\/g, "");
        const vRes = await fetch(cleanLink, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://downloadgram.org/",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (vRes.ok) {
          const ab = await vRes.arrayBuffer();
          const buf = Buffer.from(ab);
          if (buf.byteLength > 10000) {
            return buf;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Strategy 1 (Downloadgram) failed:", err);
  }

  // ── Strategy 2: Multi-Node Public Media Resolvers (Cobalt) ──
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
          url: cleanReelUrl,
          videoQuality: "720",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (cobRes.ok) {
        const cobData = await cobRes.json();
        const targetUrl = cobData.url || cobData.audio || cobData.stream;
        if (targetUrl) {
          const streamRes = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
          if (streamRes.ok) {
            const ab = await streamRes.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf.byteLength > 10000) return buf;
          }
        }
      }
    } catch {
      // Continue to next
    }
  }

  // ── Strategy 3: OpenGraph Video Scraper ──
  try {
    const pageRes = await fetch(cleanReelUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (pageRes.ok) {
      const pageHtml = await pageRes.text();
      const ogMatch =
        pageHtml.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
        pageHtml.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i);
      if (ogMatch?.[1]) {
        const ogUrl = ogMatch[1].replace(/&amp;/g, "&");
        const vRes = await fetch(ogUrl, { signal: AbortSignal.timeout(15000) });
        if (vRes.ok) {
          const ab = await vRes.arrayBuffer();
          const buf = Buffer.from(ab);
          if (buf.byteLength > 10000) return buf;
        }
      }
    }
  } catch (err) {
    console.warn("Strategy 3 (OpenGraph) failed:", err);
  }

  // ── Strategy 4: Instagram GraphQL / Mobile API (with session cookie if configured) ──
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (sessionId) {
    try {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "X-IG-App-ID": "936619743392459",
        "Sec-Fetch-Site": "same-origin",
        "Cookie": `sessionid=${sessionId};`,
      };

      const apiRes = await fetch(`https://www.instagram.com/p/${reelId}/?__a=1&__d=dis`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        const directUrl =
          apiData?.items?.[0]?.video_versions?.[0]?.url ||
          apiData?.graphql?.shortcode_media?.video_url ||
          apiData?.items?.[0]?.carousel_media?.[0]?.video_versions?.[0]?.url;

        if (directUrl) {
          const vRes = await fetch(directUrl, {
            headers: { Referer: "https://www.instagram.com/" },
            signal: AbortSignal.timeout(15000),
          });
          if (vRes.ok) {
            const ab = await vRes.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf.byteLength > 10000) return buf;
          }
        }
      }
    } catch (err) {
      console.warn("Strategy 4 (Session) failed:", err);
    }
  }

  return null;
}
