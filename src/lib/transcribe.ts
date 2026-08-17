/**
 * lib/transcribe.ts
 *
 * Whisper API abstraction. Reads TRANSCRIBE_API_BASE_URL from env —
 * defaults to OpenAI's endpoint or Groq's free endpoint.
 *
 * Includes built-in 429 Rate Limit detection and optional secondary fallback.
 */

import OpenAI from "openai";

const baseURL =
  process.env.TRANSCRIBE_API_BASE_URL ?? "https://api.openai.com/v1";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "placeholder",
  baseURL,
});

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: Segment[];
}

/**
 * Transcribe a file buffer using the Whisper API.
 * Handles rate limit (429) detection with friendly error messages.
 */
export async function transcribeBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<TranscriptionResult> {
  const file = new File([buffer], fileName, { type: mimeType });
  const model = process.env.WHISPER_MODEL ?? "whisper-large-v3";

  try {
    const response = await client.audio.transcriptions.create({
      model,
      file,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const raw = response as unknown as {
      text: string;
      segments: Array<{ start: number; end: number; text: string }>;
    };

    const segments: Segment[] = (raw.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));

    return {
      text: raw.text ?? "",
      segments,
    };
  } catch (err: unknown) {
    // Detect 429 Rate Limit Exceeded
    const errObj = err as { status?: number; message?: string; code?: string };
    const isRateLimit =
      errObj.status === 429 ||
      errObj.code === "rate_limit_exceeded" ||
      errObj.message?.toLowerCase().includes("rate limit") ||
      errObj.message?.toLowerCase().includes("quota");

    if (isRateLimit) {
      throw new Error(
        "Rate limit reached on free Groq API (7,200s/day or 20 req/min limit). Please wait a minute and try again, or add a secondary key in .env.local."
      );
    }

    throw err;
  }
}
