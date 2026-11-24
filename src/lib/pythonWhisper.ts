/**
 * lib/pythonWhisper.ts
 *
 * Local Open-Source OpenAI Whisper bridge (https://github.com/openai/whisper)
 * Runs official OpenAI Whisper directly via Python + PyTorch.
 * Supports Apple Silicon GPU (MPS) and CPU.
 * 100% free, runs offline, zero API keys required.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface PythonWhisperResult {
  text: string;
  segments: Segment[];
  language?: string;
  model?: string;
  engine: "openai-whisper";
}

let isWhisperAvailableCache: boolean | null = null;

/**
 * Checks if OpenAI Whisper Python package is installed and executable.
 */
export async function checkPythonWhisperAvailable(): Promise<boolean> {
  if (isWhisperAvailableCache !== null) return isWhisperAvailableCache;

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };

    const proc = spawn("python3", ["-c", "import whisper; print('ok')"], { env });

    proc.on("close", (code) => {
      isWhisperAvailableCache = code === 0;
      resolve(isWhisperAvailableCache);
    });

    proc.on("error", () => {
      isWhisperAvailableCache = false;
      resolve(false);
    });
  });
}

/**
 * Transcribes an audio or video buffer using the local openai-whisper Python model.
 */
export async function transcribeWithPythonWhisper(
  buffer: Buffer,
  fileName: string,
  options?: {
    language?: string;
    model?: string;
  }
): Promise<PythonWhisperResult> {
  if (!buffer || buffer.byteLength < 200) {
    throw new Error("Invalid audio buffer: file is empty or corrupted.");
  }

  const model = options?.model || process.env.LOCAL_WHISPER_MODEL || "base";
  const language = options?.language;

  // Write audio buffer to temporary file for Whisper processing
  const ext = path.extname(fileName) || ".mp3";
  const tempId = `whisper_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tempFilePath = path.join(os.tmpdir(), `${tempId}${ext}`);
  fs.writeFileSync(tempFilePath, buffer);

  const scriptPath = path.join(process.cwd(), "scripts", "transcribe_whisper.py");

  const args = [scriptPath, tempFilePath, "--model", model];
  if (language && language !== "auto") {
    args.push("--language", language);
  }

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };

    const proc = spawn("python3", args, { env });
    let stdoutData = "";
    let stderrData = "";

    proc.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      // Clean up temp audio file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}

      if (code !== 0) {
        let errMsg = "OpenAI Whisper transcription failed.";
        try {
          const errObj = JSON.parse(stderrData);
          if (errObj.error) errMsg = errObj.error;
        } catch {
          if (stderrData.trim()) errMsg = stderrData.trim();
        }
        return reject(new Error(errMsg));
      }

      try {
        // Robust JSON extraction in case any prefix logs were written
        const jsonStart = stdoutData.indexOf("{");
        const jsonEnd = stdoutData.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("No JSON delimiter found");
        }
        const jsonSubstring = stdoutData.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonSubstring);

        resolve({
          text: parsed.text || "",
          segments: parsed.segments || [],
          language: parsed.language,
          model: parsed.model || model,
          engine: "openai-whisper",
        });
      } catch {
        reject(
          new Error(
            `Failed to parse Whisper JSON output: ${stdoutData.slice(0, 200)}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch {}
      reject(err);
    });
  });
}
