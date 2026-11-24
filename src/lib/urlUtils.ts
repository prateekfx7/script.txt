/**
 * lib/urlUtils.ts
 *
 * Extracts and sanitizes URLs from arbitrary input text.
 * Handles newlines, spaces, commas, query params, and domain-only URLs without http(s).
 */

export function extractUrls(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  // Match URLs with http(s), www., or domain paths
  const pattern = /((?:https?:\/\/|www\.)[^\s,;"'<>]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s,;"'<>]*)/gi;
  const rawMatches = text.match(pattern) || [];
  const urls: string[] = [];

  for (const match of rawMatches) {
    let clean = match.trim().replace(/[),.;"']+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "https://" + clean;
    }
    // Filter out obvious false positives or empty
    if (clean.length > 8 && !urls.includes(clean)) {
      urls.push(clean);
    }
  }

  return urls;
}

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
 * Parses and detects media links (safe for client and server)
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
      displayName: `YouTube Video`,
    };
  }

  // 2. Instagram
  const igMatch = cleanUrl.match(/instagram\.com\/(?:reel|reels|p|tv|share)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch?.[1]) {
    return {
      platform: "instagram",
      id: igMatch[1],
      cleanUrl,
      displayName: `Instagram Reel`,
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
