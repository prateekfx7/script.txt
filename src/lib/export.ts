/**
 * lib/export.ts
 *
 * Formatters for TXT, SRT, and VTT export formats.
 * All take a segments array and return a string.
 */

export interface Segment {
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

/** Format seconds as SRT timestamp: HH:MM:SS,mmm */
function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** Format seconds as WebVTT timestamp: HH:MM:SS.mmm */
function toVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** Plain text: just the transcript text */
export function toTxt(text: string): string {
  return text;
}

/** SRT subtitle format */
export function toSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      return [
        String(i + 1),
        `${toSrtTime(seg.start)} --> ${toSrtTime(seg.end)}`,
        seg.text,
        "",
      ].join("\n");
    })
    .join("\n");
}

/** WebVTT format */
export function toVtt(segments: Segment[]): string {
  const header = "WEBVTT\n\n";
  const body = segments
    .map((seg, i) => {
      return [
        String(i + 1),
        `${toVttTime(seg.start)} --> ${toVttTime(seg.end)}`,
        seg.text,
        "",
      ].join("\n");
    })
    .join("\n");
  return header + body;
}
