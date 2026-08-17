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
    onProgress?.("Transcribing audio…");
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = false;
    }

    // Use multilingual Whisper model supporting 99+ languages locally
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === "progress" && p.progress) {
          onProgress?.(`Transcribing audio… ${Math.round(p.progress)}%`);
        } else if (p.status === "ready") {
          onProgress?.("Transcribing speech…");
        }
      },
    });
  }
  return transcriberPromise;
}

/**
 * Transcribes any video/audio file 100% locally on the device using browser WASM/WebAudio.
 * 0 API keys required, 0 network data transmitted.
 */
export async function transcribeFileLocally(
  file: File,
  onProgress?: (msg: string) => void,
  language?: string
): Promise<LocalTranscriptionResult> {
  onProgress?.("Preparing audio…");
  const audioData = await decodeAudioFile(file);

  onProgress?.("Transcribing speech…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriber = (await getTranscriber(onProgress)) as any;

  onProgress?.("Transcribing speech…");

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
