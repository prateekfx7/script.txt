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
