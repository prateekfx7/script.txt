/**
 * Client-side link media fetcher & downloader.
 * Downloads video/audio from Instagram Reels, direct URLs, or public media links into a browser File object.
 */
export async function downloadLinkAsFile(
  url: string,
  onProgress?: (msg: string) => void
): Promise<File> {
  const cleanUrl = url.trim();

  // 1. INSTAGRAM REELS (via server-assisted stream proxy)
  const isInsta = /instagram\.com\/(reel|p|reels)\/([a-zA-Z0-9_-]+)/i.test(cleanUrl);
  if (isInsta) {
    const match = cleanUrl.match(/instagram\.com\/(reel|p|reels)\/([a-zA-Z0-9_-]+)/i);
    const shortcode = match?.[2] || "reel";

    onProgress?.("Fetching Instagram video track…");

    const res = await fetch("/api/get-insta-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl }),
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100) {
        return new File([blob], `instagram_${shortcode}.mp4`, { type: "video/mp4" });
      }
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.error ||
        `Instagram Reel (${shortcode}) requires login access on Instagram. Download the MP4 video and drop the file into the upload box!`
    );
  }

  // 2. DIRECT MEDIA LINKS & GOOGLE DRIVE
  let targetUrl = cleanUrl;
  const driveMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch?.[1]) {
    targetUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  onProgress?.("Downloading video/audio track from link…");

  // Attempt direct browser fetch
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100) {
        const ext = targetUrl.split("/").pop()?.split("?")[0]?.split(".").pop() || "mp4";
        const fileName = `link_media.${ext}`;
        return new File([blob], fileName, { type: blob.type || "video/mp4" });
      }
    }
  } catch (directErr) {
    console.warn("Direct browser fetch blocked by CORS, routing through server proxy...", directErr);
  }

  // Server-side proxy download fallback (bypasses CORS completely)
  onProgress?.("Preparing media download…");
  try {
    const proxyRes = await fetch("/api/proxy-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
    });

    if (proxyRes.ok) {
      const blob = await proxyRes.blob();
      if (blob.size > 100) {
        const ext = targetUrl.split("/").pop()?.split("?")[0]?.split(".").pop() || "mp4";
        const fileName = `link_media.${ext}`;
        return new File([blob], fileName, { type: blob.type || "video/mp4" });
      }
    }
  } catch (proxyErr) {
    console.warn("Server proxy download failed:", proxyErr);
  }

  throw new Error(
    "Could not download video directly from this URL due to website security. Please download the video file to your device and drop it into the upload box!"
  );
}
