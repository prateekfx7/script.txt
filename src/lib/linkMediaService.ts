/**
 * lib/linkMediaService.ts
 *
 * Automated link media service:
 * 1. Instagram Reels & Posts: Direct internal API extraction + CDN streaming.
 * 2. YouTube Videos & Shorts: Instant multilingual closed caption & subtitle extraction.
 * 3. Google Drive, Dropbox & Direct Web Media (.mp3, .mp4, etc.): Direct streaming to Groq Whisper AI.
 */

import { YoutubeTranscript } from "youtube-transcript";
import { getSubtitles } from "youtube-caption-extractor";

export interface LinkPlatformInfo {
  platform: "youtube" | "instagram" | "gdrive" | "dropbox" | "direct_media" | "other";
  id?: string;
  cleanUrl: string;
  displayName: string;
  directDownloadUrl?: string;
}

const ENCODING_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Converts Instagram shortcode (e.g. DZqla5XBHHy) to numeric media PK
 */
export function shortcodeToPk(shortcode: string): string {
  let clean = shortcode;
  if (clean.length > 28) {
    clean = clean.slice(0, -28);
  }
  let pk = BigInt(0);
  for (const c of clean) {
    const idx = BigInt(ENCODING_CHARS.indexOf(c));
    if (idx === BigInt(-1)) continue;
    pk = pk * BigInt(64) + idx;
  }
  return pk.toString();
}

/**
 * Parses and detects media links
 */
export function parseMediaLink(rawUrl: string): LinkPlatformInfo {
  let cleanUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  // 1. YouTube
  const ytMatch = cleanUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch?.[1]) {
    return {
      platform: "youtube",
      id: ytMatch[1],
      cleanUrl,
      displayName: `YouTube Video (${ytMatch[1]})`,
    };
  }

  // 2. Instagram
  const igMatch = cleanUrl.match(/instagram\.com\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch?.[1]) {
    return {
      platform: "instagram",
      id: igMatch[1],
      cleanUrl,
      displayName: `Instagram Reel (${igMatch[1]})`,
    };
  }

  // 3. Google Drive
  const driveMatch = cleanUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (driveMatch?.[1]) {
    return {
      platform: "gdrive",
      id: driveMatch[1],
      cleanUrl,
      displayName: `Google Drive File`,
      directDownloadUrl: `https://drive.usercontent.google.com/download?id=${driveMatch[1]}&export=download`,
    };
  }

  // 4. Dropbox
  if (cleanUrl.toLowerCase().includes("dropbox.com")) {
    let dlUrl = cleanUrl.replace(/(\?|&)dl=0/i, "$1dl=1");
    if (!dlUrl.includes("dl=1") && !dlUrl.includes("raw=1")) {
      dlUrl += (dlUrl.includes("?") ? "&" : "?") + "dl=1";
    }
    return {
      platform: "dropbox",
      cleanUrl,
      displayName: `Dropbox File`,
      directDownloadUrl: dlUrl,
    };
  }

  // 5. Direct Audio/Video URLs
  if (/\.(mp3|mp4|m4a|wav|webm|ogg|aac|flac)(\?.*)?$/i.test(cleanUrl)) {
    const fileName = cleanUrl.split("/").pop()?.split("?")[0] || "audio.mp3";
    return {
      platform: "direct_media",
      cleanUrl,
      displayName: fileName,
      directDownloadUrl: cleanUrl,
    };
  }

  return {
    platform: "other",
    cleanUrl,
    displayName: "Online Media Link",
    directDownloadUrl: cleanUrl,
  };
}

/**
 * Directly extracts and downloads the video buffer from an Instagram Reel / Post
 */
export async function fetchInstagramVideoBuffer(shortcode: string): Promise<{ buffer: Buffer; fileName: string }> {
  const pk = shortcodeToPk(shortcode);
  const sessionId = process.env.INSTAGRAM_SESSION_ID;

  const endpoints = [
    `https://www.instagram.com/api/v1/media/${pk}/info/`,
    `https://i.instagram.com/api/v1/media/${pk}/info/`,
  ];

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "129477",
    "X-IG-WWW-Claim": "0",
    "Origin": "https://www.instagram.com",
    "Referer": "https://www.instagram.com/",
    "Accept": "*/*",
  };

  if (sessionId) {
    headers["Cookie"] = `sessionid=${sessionId}; ds_user_id=${sessionId.split("%")[0]};`;
  }

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const item = data?.items?.[0];
        const videoUrl =
          item?.video_versions?.[0]?.url ||
          item?.carousel_media?.[0]?.video_versions?.[0]?.url;

        if (videoUrl) {
          const vRes = await fetch(videoUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(20000),
          });

          if (vRes.ok) {
            const arrayBuf = await vRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            if (buffer.byteLength > 1000) {
              return {
                buffer,
                fileName: `instagram_${shortcode}.mp4`,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Instagram info fetch error on ${ep}:`, err);
    }
  }

  throw new Error("Could not retrieve video stream from Instagram. Please make sure the reel is public.");
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Fast, multi-tiered YouTube transcript/caption extractor
 */
export async function extractYoutubeTranscript(
  youtubeId: string,
  language?: string
): Promise<CaptionSegment[] | null> {
  const targetLang = language && language !== "auto" ? language.toLowerCase() : undefined;

  // Strategy 1: youtube-transcript package
  try {
    const raw = await YoutubeTranscript.fetchTranscript(youtubeId, {
      lang: targetLang,
    });
    if (raw && raw.length > 0) {
      return raw.map((item) => ({
        start: Math.round((item.offset || 0) / 1000),
        end: Math.round(((item.offset || 0) + (item.duration || 0)) / 1000),
        text: (item.text || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
      }));
    }
  } catch {
    // try strategy 2
  }

  // Strategy 2: youtube-caption-extractor with targeted language
  try {
    const raw = await getSubtitles({
      videoID: youtubeId,
      lang: targetLang || "en",
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
  } catch {
    // try strategy 3
  }

  // Strategy 3: youtube-caption-extractor default auto
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
  } catch {
    // all strategies failed
  }

  return null;
}

/**
 * Downloads a direct media stream buffer from public URLs, Google Drive, or Dropbox
 */
export async function downloadDirectMedia(
  url: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Failed to access file (${res.status} ${res.statusText}).`);
  }

  const contentType = res.headers.get("content-type") || "audio/mpeg";
  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);

  if (buffer.byteLength < 500) {
    throw new Error("File is empty or not accessible.");
  }

  const headerStr = buffer.toString("utf8", 0, Math.min(buffer.byteLength, 150)).toLowerCase();
  if (headerStr.includes("<html") || headerStr.includes("<!doctype")) {
    throw new Error("The link returned a webpage instead of an audio/video file.");
  }

  const fileName = url.split("/").pop()?.split("?")[0] || "media.mp3";

  return {
    buffer,
    mimeType: contentType.includes("audio") || contentType.includes("video") ? contentType : "audio/mpeg",
    fileName,
  };
}
