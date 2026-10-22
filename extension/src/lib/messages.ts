import { TranscriptionResult, TranscribeProgress } from "./types";

export type ExtensionMessage =
  | {
      type: "START_TRANSCRIBE";
      audioData: number[]; // Float32 samples converted for structured clone
      sampleRate: number;
      language?: string;
      fileName: string;
    }
  | {
      type: "TRANSCRIBE_PROGRESS";
      progress: TranscribeProgress;
    }
  | {
      type: "TRANSCRIBE_COMPLETE";
      result: TranscriptionResult;
    }
  | {
      type: "TRANSCRIBE_ERROR";
      error: string;
    }
  | {
      type: "GET_CURRENT_STATE";
    }
  | {
      type: "CURRENT_STATE_RESPONSE";
      isTranscribing: boolean;
      progress?: TranscribeProgress;
      latestResult?: TranscriptionResult;
      error?: string;
    };
