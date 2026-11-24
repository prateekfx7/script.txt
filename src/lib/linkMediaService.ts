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
import { fetchInstagramVideoBuffer as resolveInstagramVideo } from "./instagramResolver";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

import {
  parseMediaLink,
  shortcodeToPk,
  type LinkPlatformInfo,
} from "./urlUtils";

export { parseMediaLink, shortcodeToPk, type LinkPlatformInfo };

/**
 * Fetches YouTube video creator/channel name via oEmbed
 */
export async function fetchYoutubeAuthor(youtubeId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.author_name) {
        const cleanAuthor = data.author_name.trim().replace(/^@/, "");
        return `Video by @${cleanAuthor}`;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

let isYtDlpAvailableCache: boolean | null = null;

/**
 * Checks if python3 and yt-dlp are available on the host system
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  if (isYtDlpAvailableCache !== null) return isYtDlpAvailableCache;

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };

    const proc = spawn("python3", ["-m", "yt_dlp", "--version"], { env });

    proc.on("close", (code) => {
      isYtDlpAvailableCache = code === 0;
      resolve(isYtDlpAvailableCache);
    });

    proc.on("error", () => {
      isYtDlpAvailableCache = false;
      resolve(false);
    });
  });
}

/**
 * Directly extracts and downloads audio from an Instagram Reel / Post
 * Uses yt-dlp first (fast, reliable, handles modern Instagram CDN without cookies),
 * with fallbacks to internal APIs.
 */
export async function fetchInstagramVideoBuffer(
  shortcode: string,
  rawUrl?: string
): Promise<{
  buffer: Buffer;
  fileName: string;
  displayName: string;
  author?: string;
}> {
  const targetUrl = rawUrl || `https://www.instagram.com/reel/${shortcode}/`;

  // ── Strategy 1: yt-dlp (Native, fastest, handles Instagram without cookies) ──
  const canUseYtDlp = await isYtDlpAvailable();
  if (canUseYtDlp) {
    try {
      const tempId = `ig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const outTemplate = path.join(os.tmpdir(), `${tempId}.%(ext)s`);

      const result = await new Promise<{
        buffer: Buffer;
        fileName: string;
        displayName: string;
        author?: string;
      }>((resolve, reject) => {
        const env = {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        };

        const proc = spawn(
          "python3",
          [
            "-m",
            "yt_dlp",
            "-x",
            "--audio-format",
            "mp3",
            "--no-playlist",
            "--max-filesize",
            "100M",
            "--no-simulate",
            "--print",
            "%(uploader)s",
            "-o",
            outTemplate,
            targetUrl,
          ],
          { env }
        );

        let stdoutData = "";
        let stderrData = "";
        proc.stdout.on("data", (chunk) => {
          stdoutData += chunk.toString();
        });
        proc.stderr.on("data", (chunk) => {
          stderrData += chunk.toString();
        });

        proc.on("close", (code) => {
          const mp3Path = path.join(os.tmpdir(), `${tempId}.mp3`);
          const uploader = stdoutData.trim().split("\n")[0]?.trim();
          const displayName = uploader && uploader !== "NA" ? `Video by @${uploader}` : `Instagram Reel`;

          if (fs.existsSync(mp3Path)) {
            try {
              const buffer = fs.readFileSync(mp3Path);
              fs.unlinkSync(mp3Path);
              return resolve({
                buffer,
                fileName: `instagram_${shortcode}.mp3`,
                displayName,
                author: uploader && uploader !== "NA" ? `@${uploader}` : undefined,
              });
            } catch (readErr) {
              return reject(readErr);
            }
          }

          // Check if original file exists in tmpdir
          const baseDir = os.tmpdir();
          try {
            const files = fs.readdirSync(baseDir).filter((f) => f.startsWith(tempId));
            if (files.length > 0) {
              const found = path.join(baseDir, files[0]);
              const buffer = fs.readFileSync(found);
              fs.unlinkSync(found);
              return resolve({
                buffer,
                fileName: `instagram_${shortcode}.mp3`,
                displayName,
                author: uploader && uploader !== "NA" ? `@${uploader}` : undefined,
              });
            }
          } catch {}

          reject(new Error(`yt-dlp Instagram extraction failed with code ${code}: ${stderrData}`));
        });

        proc.on("error", (err) => reject(err));
      });

      if (result && result.buffer.byteLength > 1000) {
        return result;
      }
    } catch (ytErr) {
      console.warn("[linkMediaService] yt-dlp Instagram extraction fallback, trying internal APIs:", ytErr);
    }
  }

  // ── Strategy 2: Internal Instagram APIs Fallback ──
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

        const username = item?.user?.username || item?.owner?.username;
        const displayName = username ? `Video by @${username}` : `Instagram Reel`;

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
                displayName,
                author: username ? `@${username}` : undefined,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Instagram info fetch error on ${ep}:`, err);
    }
  }

  // Fallback to robust multi-strategy extractor if internal APIs fail
  console.log("Internal APIs failed, falling back to multi-strategy resolver for shortcode:", shortcode);
  const fallbackBuffer = await resolveInstagramVideo(shortcode, `https://www.instagram.com/reel/${shortcode}/`);
  if (fallbackBuffer) {
    return {
      buffer: fallbackBuffer,
      fileName: `instagram_${shortcode}.mp4`,
      displayName: `Instagram Reel`,
      author: undefined,
    };
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

/**
 * Downloads audio track directly from YouTube using yt-dlp
 * for videos without closed captions so they can be transcribed with Whisper.
 */
export async function fetchYoutubeAudioBuffer(
  youtubeId: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const canUseYtDlp = await isYtDlpAvailable();
  if (!canUseYtDlp) {
    throw new Error(
      "This YouTube video has no closed captions enabled on YouTube. Drop the audio or video file directly into the upload area to transcribe."
    );
  }

  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  const tempId = `yt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outTemplate = path.join(os.tmpdir(), `${tempId}.%(ext)s`);

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };

    const proc = spawn(
      "python3",
      [
        "-m",
        "yt_dlp",
        "-x",
        "--audio-format",
        "mp3",
        "--no-playlist",
        "--max-filesize",
        "150M",
        "-o",
        outTemplate,
        url,
      ],
      { env }
    );

    let stderrData = "";
    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      const mp3Path = path.join(os.tmpdir(), `${tempId}.mp3`);
      if (fs.existsSync(mp3Path)) {
        try {
          const buffer = fs.readFileSync(mp3Path);
          fs.unlinkSync(mp3Path);
          return resolve({
            buffer,
            fileName: `youtube_${youtubeId}.mp3`,
          });
        } catch (readErr) {
          return reject(readErr);
        }
      }

      // Check if original webm or m4a remains
      const baseDir = os.tmpdir();
      try {
        const files = fs.readdirSync(baseDir).filter((f) => f.startsWith(tempId));
        if (files.length > 0) {
          const found = path.join(baseDir, files[0]);
          const buffer = fs.readFileSync(found);
          fs.unlinkSync(found);
          return resolve({
            buffer,
            fileName: `youtube_${youtubeId}.mp3`,
          });
        }
      } catch {}

      reject(
        new Error(
          `Could not extract audio from this YouTube video. Please make sure the video is public and accessible.`
        )
      );
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Downloads audio from any social media or web video URL using yt-dlp
 * (TikTok, Twitter/X, Facebook, Threads, Vimeo, etc.)
 */
export async function fetchGenericMediaAudioBuffer(
  url: string
): Promise<{ buffer: Buffer; fileName: string; displayName: string }> {
  const canUseYtDlp = await isYtDlpAvailable();
  if (!canUseYtDlp) {
    throw new Error(
      "Direct media stream extraction is not available on this server. Please download and drop the file into the upload area."
    );
  }

  const tempId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outTemplate = path.join(os.tmpdir(), `${tempId}.%(ext)s`);

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };

    const proc = spawn(
      "python3",
      [
        "-m",
        "yt_dlp",
        "-x",
        "--audio-format",
        "mp3",
        "--no-playlist",
        "--max-filesize",
        "150M",
        "--no-simulate",
        "--print",
        "%(title)s",
        "-o",
        outTemplate,
        url,
      ],
      { env }
    );

    let stdoutData = "";
    let stderrData = "";
    proc.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      const mp3Path = path.join(os.tmpdir(), `${tempId}.mp3`);
      const title = stdoutData.trim().split("\n")[0]?.trim();
      const displayName = title && title !== "NA" ? title : "Online Media";

      if (fs.existsSync(mp3Path)) {
        try {
          const buffer = fs.readFileSync(mp3Path);
          fs.unlinkSync(mp3Path);
          return resolve({
            buffer,
            fileName: `media_${tempId}.mp3`,
            displayName,
          });
        } catch (readErr) {
          return reject(readErr);
        }
      }

      // Check if original file exists in tmpdir
      const baseDir = os.tmpdir();
      try {
        const files = fs.readdirSync(baseDir).filter((f) => f.startsWith(tempId));
        if (files.length > 0) {
          const found = path.join(baseDir, files[0]);
          const buffer = fs.readFileSync(found);
          fs.unlinkSync(found);
          return resolve({
            buffer,
            fileName: `media_${tempId}.mp3`,
            displayName,
          });
        }
      } catch {}

      reject(new Error(`Could not extract media: ${stderrData || `Code ${code}`}`));
    });

    proc.on("error", (err) => reject(err));
  });
}
