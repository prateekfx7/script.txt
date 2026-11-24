import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side media download proxy that bypasses browser CORS restrictions.
 * Server-to-server fetches are exempt from browser CORS security rules.
 */
async function handleProxy(url: string) {
  try {
    let downloadUrl = url.trim();

    // Convert Google Drive view links to direct download links
    const driveMatch = downloadUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch?.[1]) {
      downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    const response = await fetch(downloadUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Media server returned HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength < 50) {
      return NextResponse.json({ error: "Downloaded media file is empty" }, { status: 422 });
    }

    // Return binary media stream to browser
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": arrayBuffer.byteLength.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    console.error("proxy-download error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to proxy media download" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url query parameter is required" }, { status: 400 });
  }
  return handleProxy(url);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }
  return handleProxy(url);
}
