import { decodeAudioFile } from "./webAudio";

export interface LocalSegment {
  start: number;
  end: number;
  text: string;
}

export interface LocalTranscriptionResult {
  text: string;
  segments: LocalSegment[];
}

// Model singleton cache in memory
let transcriberPromise: Promise<unknown> | null = null;

async function getTranscriber(onProgress?: (msg: string) => void) {
  if (!transcriberPromise) {
    onProgress?.("Loading local Whisper AI model (~40MB, cached in browser)...");
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;

    // Use multilingual whisper-tiny model supporting 99+ languages
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === "progress" && p.progress) {
          onProgress?.(`Downloading AI model… ${Math.round(p.progress)}%`);
        } else if (p.status === "ready") {
          onProgress?.("Model ready! Decoding audio…");
        }
      },
    });
  }
  return transcriberPromise;
}

/**
 * Transcribes any video/audio file locally inside the user's browser with multilingual support.
 */
export async function transcribeFileLocally(
  file: File,
  onProgress?: (msg: string) => void,
  language?: string
): Promise<LocalTranscriptionResult> {
  onProgress?.("Decoding video/audio track…");
  const audioData = await decodeAudioFile(file);

  onProgress?.("Initializing local Whisper engine…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriber = (await getTranscriber(onProgress)) as any;

  onProgress?.("Transcribing locally on your device…");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    task: "transcribe",
  };

  if (language && language !== "auto") {
    opts.language = language;
  }

  const output = await transcriber(audioData, opts);

  const text = output.text || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChunks = (output.chunks || []) as Array<{ timestamp: [number, number]; text: string }>;

  const segments: LocalSegment[] = rawChunks.map((chunk) => {
    const [start, end] = chunk.timestamp || [0, 0];
    return {
      start: typeof start === "number" ? start : 0,
      end: typeof end === "number" ? end : 0,
      text: (chunk.text || "").trim(),
    };
  });

  return {
    text: text.trim(),
    segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text: text.trim() }],
  };
}
