/**
 * lib/transcribe.ts
 *
 * OpenAI Whisper API abstraction. Reads OPENAI_API_KEY and TRANSCRIBE_API_BASE_URL from env.
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
 * Transcribe a file buffer using the OpenAI Whisper API.
 */
export async function transcribeBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  language?: string
): Promise<TranscriptionResult> {
  const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
  const model = process.env.WHISPER_MODEL ?? "whisper-1";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model,
      file,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    };

    if (language && language !== "auto") {
      params.language = language.toLowerCase();
    }

    const response = await client.audio.transcriptions.create(params);

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
      segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text: raw.text ?? "" }],
    };
  } catch (err: unknown) {
    const errObj = err as { status?: number; message?: string; code?: string };
    const isRateLimit =
      errObj.status === 429 ||
      errObj.code === "rate_limit_exceeded" ||
      errObj.message?.toLowerCase().includes("rate limit") ||
      errObj.message?.toLowerCase().includes("quota");

    if (isRateLimit) {
      throw new Error(
        "OpenAI Whisper API rate limit / quota exceeded. Please check your OpenAI API key and billing credits."
      );
    }

    throw err;
  }
}
