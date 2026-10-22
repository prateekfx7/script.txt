export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: Segment[];
  duration?: number;
  fileName?: string;
  timestamp?: number;
}

export interface TranscribeProgress {
  status: string;
  progress?: number;
  isModelLoading?: boolean;
}

export type TranscribeMode = "upload" | "link";
