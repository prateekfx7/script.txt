import { Segment, TranscriptionResult } from "./types";

export interface ParsedLink {
  platform: "youtube" | "direct_media" | "unknown";
  id?: string;
  url: string;
}

export function parseInputUrl(rawUrl: string): ParsedLink {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // 1. YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch?.[1]) {
    return {
      platform: "youtube",
      id: ytMatch[1],
      url,
    };
  }

  // 2. Direct media file
  if (/\.(mp3|mp4|wav|m4a|mov|ogg|webm)(\?.*)?$/i.test(url)) {
    return {
      platform: "direct_media",
      url,
    };
  }

  return {
    platform: "unknown",
    url,
  };
}

/**
 * Attempts to extract YouTube transcript directly in the browser.
 */
export async function fetchYouTubeTranscriptClient(videoId: string, lang = "en"): Promise<TranscriptionResult | null> {
  try {
    // Attempt 1: Fetch timedtext track list directly
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
    const res = await fetch(timedtextUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.events && Array.isArray(data.events)) {
        const segments: Segment[] = [];
        for (const evt of data.events) {
          if (!evt.segs || !evt.tStartMs) continue;
          const text = evt.segs.map((s: { utf8?: string }) => s.utf8 || "").join("").trim();
          if (!text || text === "\n") continue;
          const start = Math.round((evt.tStartMs || 0) / 1000);
          const end = Math.round(((evt.tStartMs || 0) + (evt.dDurationMs || 0)) / 1000);
          segments.push({ start, end, text });
        }

        if (segments.length > 0) {
          const fullText = segments.map((s) => s.text).join(" ");
          return {
            text: fullText,
            segments,
            fileName: `YouTube Video (${videoId})`,
            duration: segments[segments.length - 1]?.end || 0,
            timestamp: Date.now(),
          };
        }
      }
    }
  } catch (err) {
    console.warn("YouTube timedtext direct fetch failed:", err);
  }

  return null;
}
