/**
 * lib/transcribe.ts
 *
 * Unified Whisper Speech Recognition Engine:
 * 1. Local Open-Source Whisper (https://github.com/openai/whisper) via PyTorch + Python.
 * 2. Groq Whisper (ultra-fast Whisper LPU cloud).
 * 3. OpenAI Whisper Cloud API (whisper-1).
 */

import OpenAI from "openai";
import {
  transcribeWithPythonWhisper,
  checkPythonWhisperAvailable,
} from "./pythonWhisper";

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: Segment[];
}

export function getTranscribeConfig() {
  const engine = (process.env.WHISPER_ENGINE || "").toLowerCase();
  const isGroq =
    engine === "groq" ||
    (!engine && !!process.env.GROQ_API_KEY) ||
    (process.env.TRANSCRIBE_API_BASE_URL ?? "").includes("groq.com");

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

  const baseURL =
    process.env.TRANSCRIBE_API_BASE_URL ||
    (isGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");

  const defaultModel = isGroq ? "whisper-large-v3-turbo" : "whisper-1";
  const model = process.env.WHISPER_MODEL || defaultModel;

  return {
    engine: engine || (apiKey ? (isGroq ? "groq" : "openai") : "openai-whisper"),
    provider: isGroq ? "groq" : "openai",
    apiKey,
    baseURL,
    model,
  };
}

function getOpenAIClient() {
  const config = getTranscribeConfig();
  if (!config.apiKey) {
    throw new Error("No API key configured for cloud Whisper.");
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

/**
 * Checks whether the server has any active transcription engine:
 * Either local Python openai-whisper or cloud Whisper API keys.
 */
export async function isServerTranscribeAvailable(): Promise<boolean> {
  const engine = (process.env.WHISPER_ENGINE || "").toLowerCase();
  if (engine.includes("whisper") || engine === "local") {
    return true;
  }
  if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
    return true;
  }
  return await checkPythonWhisperAvailable();
}

/**
 * Transcribe a file buffer using local openai-whisper or cloud Whisper API.
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

  const engine = (process.env.WHISPER_ENGINE || "").toLowerCase();
  const preferLocal =
    engine === "openai-whisper" ||
    engine === "local" ||
    engine === "whisper";

  // ── 1. If explicit openai-whisper is selected, run local Python Whisper directly ──
  if (preferLocal) {
    return await transcribeWithPythonWhisper(buffer, fileName, {
      language,
      model: process.env.LOCAL_WHISPER_MODEL || "base",
    });
  }

  // ── 2. If no cloud keys exist, check if local openai-whisper is available ──
  const hasCloudKey = Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasCloudKey) {
    const isPythonAvailable = await checkPythonWhisperAvailable();
    if (isPythonAvailable) {
      return await transcribeWithPythonWhisper(buffer, fileName, {
        language,
        model: process.env.LOCAL_WHISPER_MODEL || "base",
      });
    }
    throw new Error(
      "No transcription engine available. Please install openai-whisper (pip install openai-whisper) or set GROQ_API_KEY in .env.local."
    );
  }

  // ── 3. Transcribe via Cloud Whisper (Groq / OpenAI) ──
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
    // Resilient fallback to local Python openai-whisper if cloud request fails
    try {
      const isPythonAvailable = await checkPythonWhisperAvailable();
      if (isPythonAvailable) {
        console.warn(
          "Cloud Whisper failed or hit rate limit. Falling back to local openai-whisper:",
          err
        );
        return await transcribeWithPythonWhisper(buffer, fileName, {
          language,
          model: process.env.LOCAL_WHISPER_MODEL || "base",
        });
      }
    } catch {}

    const errObj = err as {
      status?: number;
      message?: string;
      code?: string;
      error?: { message?: string };
    };
    const errMessage = (errObj.error?.message || errObj.message || "").toLowerCase();

    const isAuthError =
      errObj.status === 401 ||
      errMessage.includes("invalid api key") ||
      errMessage.includes("unauthorized") ||
      errMessage.includes("invalid_api_key");

    if (isAuthError) {
      const providerName = config.provider === "groq" ? "Groq" : "OpenAI";
      throw new Error(
        `Invalid ${providerName} API Key. Set WHISPER_ENGINE=openai-whisper in .env.local to use free local Whisper, or update your ${providerName} key.`
      );
    }

    const isRateLimit =
      errObj.status === 429 ||
      errObj.code === "rate_limit_exceeded" ||
      errMessage.includes("rate limit") ||
      errMessage.includes("quota");

    if (isRateLimit) {
      const providerName = config.provider === "groq" ? "Groq" : "OpenAI";
      throw new Error(
        `${providerName} API rate limit or quota reached. Set WHISPER_ENGINE=openai-whisper to transcribe locally with no limits.`
      );
    }

    throw err;
  }
}
