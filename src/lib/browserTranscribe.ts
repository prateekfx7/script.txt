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

let transcriberPromise: Promise<unknown> | null = null;

async function getTranscriber(onProgress?: (msg: string) => void) {
  if (!transcriberPromise) {
    onProgress?.("Initializing PrateekAI Model…");
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Multilingual Whisper tiny model
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          onProgress?.(`Loading PrateekAI Model… ${Math.round(p.progress)}%`);
        } else if (p.status === "ready") {
          onProgress?.("PrateekAI Engine ready! Analyzing audio…");
        }
      },
    });
  }
  return transcriberPromise;
}

/**
 * Transcribes any video/audio file locally on the device using PrateekAI Neural Engine.
 */
export async function transcribeFileLocally(
  file: File,
  onProgress?: (msg: string) => void,
  language?: string
): Promise<LocalTranscriptionResult> {
  onProgress?.("Extracting audio stream from file…");
  const audioData = await decodeAudioFile(file);

  onProgress?.("Running PrateekAI Model…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriber = (await getTranscriber(onProgress)) as any;

  onProgress?.("Transcribing speech with PrateekAI Model…");

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
      start: typeof start === "number" ? Math.round(start) : 0,
      end: typeof end === "number" ? Math.round(end) : 0,
      text: (chunk.text || "").trim(),
    };
  });

  return {
    text: text.trim(),
    segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text: text.trim() }],
  };
}
