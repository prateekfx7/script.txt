import { pipeline, env } from "@xenova/transformers";
import { ExtensionMessage } from "../lib/messages";
import { Segment, TranscriptionResult } from "../lib/types";

// Configure transformers.js for Chrome extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
  // Limit threads if needed for compatibility
  env.backends.onnx.wasm.numThreads = 2;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriberPromise: Promise<any> | null = null;

async function getTranscriber(onProgress?: (status: string, progress?: number, isModelLoading?: boolean) => void) {
  if (!transcriberPromise) {
    onProgress?.("Loading on-device Whisper model…", 0, true);

    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          onProgress?.(
            `Downloading Whisper model… ${Math.round(p.progress)}%`,
            p.progress,
            true
          );
        } else if (p.status === "ready") {
          onProgress?.("Model ready! Transcribing speech…", 100, false);
        }
      },
    });
  }
  return transcriberPromise;
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, _sendResponse) => {
  if (message.type === "START_TRANSCRIBE") {
    handleTranscription(message);
  }
});

async function handleTranscription(message: Extract<ExtensionMessage, { type: "START_TRANSCRIBE" }>) {
  try {
    // Notify background & popup that transcription has begun
    chrome.runtime.sendMessage({
      type: "TRANSCRIBE_PROGRESS",
      progress: { status: "Preparing audio for AI model…", progress: 5, isModelLoading: false },
    });

    const transcriber = await getTranscriber((status, progress, isModelLoading) => {
      chrome.runtime.sendMessage({
        type: "TRANSCRIBE_PROGRESS",
        progress: { status, progress, isModelLoading },
      });
    });

    chrome.runtime.sendMessage({
      type: "TRANSCRIBE_PROGRESS",
      progress: { status: "Transcribing speech on-device…", progress: 40, isModelLoading: false },
    });

    const float32Audio = new Float32Array(message.audioData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
    };

    if (message.language && message.language !== "auto") {
      opts.language = message.language;
    }

    const output = await transcriber(float32Audio, opts);

    const fullText = (output.text || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawChunks = (output.chunks || []) as Array<{ timestamp: [number, number]; text: string }>;

    const segments: Segment[] = rawChunks.map((chunk) => {
      const [start, end] = chunk.timestamp || [0, 0];
      return {
        start: typeof start === "number" ? Math.round(start) : 0,
        end: typeof end === "number" ? Math.round(end) : 0,
        text: (chunk.text || "").trim(),
      };
    });

    const result: TranscriptionResult = {
      text: fullText,
      segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text: fullText }],
      fileName: message.fileName,
      timestamp: Date.now(),
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    };

    // Store in chrome.storage.local
    await chrome.storage.local.set({
      latest_transcript: result,
      is_transcribing: false,
      last_error: null,
    });

    // Notify listeners
    chrome.runtime.sendMessage({
      type: "TRANSCRIBE_COMPLETE",
      result,
    });
  } catch (err: unknown) {
    console.error("Offscreen transcription error:", err);
    const errorMessage = err instanceof Error ? err.message : "Transcription failed on device.";

    await chrome.storage.local.set({
      is_transcribing: false,
      last_error: errorMessage,
    });

    chrome.runtime.sendMessage({
      type: "TRANSCRIBE_ERROR",
      error: errorMessage,
    });
  }
}
