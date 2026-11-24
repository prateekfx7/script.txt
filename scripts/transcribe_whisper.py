#!/usr/bin/env python3
"""
scripts/transcribe_whisper.py

Standalone CLI bridge to OpenAI Whisper (https://github.com/openai/whisper)
Transcribes audio/video files locally using PyTorch.
Outputs JSON with full text and segment timestamps.
"""

import sys
import os
import json
import argparse
import warnings
import contextlib

# Suppress FP16/Torch warnings from polluting stdout
warnings.filterwarnings("ignore")

def main():
    parser = argparse.ArgumentParser(description="Local transcription using openai/whisper")
    parser.add_argument("audio_path", help="Path to input audio/video file")
    parser.add_argument("--model", default="base", help="Whisper model name (tiny, base, small, medium, turbo, large-v3)")
    parser.add_argument("--language", default=None, help="Spoken language code (e.g. en, hi, es) or None for auto-detect")
    parser.add_argument("--device", default=None, help="Device (cpu, cuda, mps)")
    parser.add_argument("--output", default=None, help="Optional output JSON file path")

    args = parser.parse_args()

    if not os.path.isfile(args.audio_path):
        print(json.dumps({"error": f"Audio file not found: {args.audio_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        import whisper
        import torch

        # Determine best device if not explicitly provided
        device = args.device
        if not device:
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"

        # Load OpenAI Whisper model safely
        with contextlib.redirect_stdout(sys.stderr):
            model = whisper.load_model(args.model, device=device)

        transcribe_kwargs = {
            "verbose": False,
        }
        if args.language and args.language.lower() != "auto":
            transcribe_kwargs["language"] = args.language.lower()

        # Run transcription while redirecting any stdout logs to stderr
        with contextlib.redirect_stdout(sys.stderr):
            result = model.transcribe(args.audio_path, **transcribe_kwargs)

        # Format segments with start, end, text
        segments = []
        for s in result.get("segments", []):
            segments.append({
                "start": round(float(s.get("start", 0)), 2),
                "end": round(float(s.get("end", 0)), 2),
                "text": (s.get("text") or "").strip()
            })

        output_data = {
            "text": (result.get("text") or "").strip(),
            "segments": segments,
            "language": result.get("language", "auto"),
            "model": args.model,
            "engine": "openai-whisper"
        }

        json_str = json.dumps(output_data, ensure_ascii=False)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(json_str)
        else:
            # Clean JSON only to stdout
            sys.stdout.write(json_str + "\n")
            sys.stdout.flush()

    except Exception as e:
        err_msg = {"error": str(e), "type": type(e).__name__}
        print(json.dumps(err_msg), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
