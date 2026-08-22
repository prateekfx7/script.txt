/**
 * lib/transcribe.ts
 *
 * Whisper API abstraction supporting Groq (ultra-fast Whisper) and OpenAI.
 * Reads GROQ_API_KEY, OPENAI_API_KEY, TRANSCRIBE_API_BASE_URL, and WHISPER_MODEL from env.
 */

import OpenAI from "openai";

export function getTranscribeConfig() {
  const isGroq = !!process.env.GROQ_API_KEY || (process.env.TRANSCRIBE_API_BASE_URL ?? "").includes("groq.com");
  
  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "dummy-key";

  const baseURL =
    process.env.TRANSCRIBE_API_BASE_URL ||
    (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");

  // Groq default model: whisper-large-v3-turbo (or whisper-large-v3)
  // OpenAI default model: whisper-1
  const defaultModel = isGroq ? "whisper-large-v3-turbo" : "whisper-1";
  const model = process.env.WHISPER_MODEL || defaultModel;

  return {
    provider: isGroq ? "groq" : "openai",
    apiKey,
    baseURL,
    model,
  };
}

function getOpenAIClient() {
  const config = getTranscribeConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

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
 * Transcribe a file buffer using Groq or OpenAI Whisper API.
 */
export async function transcribeBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  language?: string
): Promise<TranscriptionResult> {
  if (!buffer || buffer.byteLength < 200) {
    throw new Error("Invalid audio buffer: file is empty or corrupted.");
  }

  // Ensure fileName has a recognized media extension
  let safeFileName = fileName;
  if (!/\.(mp3|mp4|m4a|wav|webm|ogg|aac|flac)$/i.test(safeFileName)) {
    safeFileName = `${safeFileName.replace(/\.[^/.]+$/, "")}.mp3`;
  }

  const file = new File([new Uint8Array(buffer)], safeFileName, {
    type: mimeType.includes("audio") || mimeType.includes("video") ? mimeType : "audio/mpeg",
  });
  const config = getTranscribeConfig();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: config.model,
      file,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    };

    if (language && language !== "auto") {
      params.language = language.toLowerCase();
    }

    const client = getOpenAIClient();
    const response = await client.audio.transcriptions.create(params);

    const raw = response as unknown as {
      text: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    const segments: Segment[] = (raw.segments ?? []).map((s) => ({
      start: typeof s.start === "number" ? s.start : 0,
      end: typeof s.end === "number" ? s.end : 0,
      text: (s.text || "").trim(),
    }));

    return {
      text: raw.text ?? "",
      segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text: raw.text ?? "" }],
    };
  } catch (err: unknown) {
    // Detect 401 Unauthorized / Invalid API Key
    const isAuthError =
      errObj.status === 401 ||
      errMessage.includes("invalid api key") ||
      errMessage.includes("unauthorized") ||
      errMessage.includes("invalid_api_key");

    if (isAuthError) {
      const providerName = config.provider === "groq" ? "Groq" : "OpenAI";
      throw new Error(
        `Invalid ${providerName} API Key. If you are on Vercel/Production, make sure GROQ_API_KEY is updated in your Vercel Project Settings > Environment Variables, then redeploy.`
      );
    }

    // Detect 429 Rate Limit Exceeded
    const isRateLimit =
      errObj.status === 429 ||
      errObj.code === "rate_limit_exceeded" ||
      errMessage.includes("rate limit") ||
      errMessage.includes("quota");

    if (isRateLimit) {
      const providerName = config.provider === "groq" ? "Groq" : "OpenAI";
      throw new Error(
        `${providerName} API rate limit or quota reached. Please check your ${providerName} account quota and API key.`
      );
    }

    // Detect invalid media file error
    if (errMessage.includes("could not process file") || errMessage.includes("valid media file")) {
      throw new Error(
        "Could not extract audio track from this media. Please ensure the link is a valid audio/video file or drop the file directly into the upload box."
      );
    }

    throw err;
  }
}
