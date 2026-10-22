# 🎙️ Scribe.txt — Chrome Extension (Manifest V3)

> **100% On-Device AI Speech-to-Text Chrome Extension**  
> Powered by **Transformers.js (WebAssembly / ONNX Runtime)** running `Xenova/whisper-tiny` directly in your browser. Zero API keys, zero cloud server costs, 100% private.

---

## ✨ Features

- **🔒 100% On-Device Whisper AI**:
  - Transcribes audio and video files directly inside Chrome via WebAssembly.
  - No audio data ever leaves your computer.
- **📁 Upload Files**:
  - Drag & drop or select `.mp4`, `.mov`, `.mp3`, `.wav`, or `.m4a` files.
- **🔗 Paste Links & Active Tab Detection**:
  - Transcribe YouTube videos, podcasts, and direct audio links.
  - 1-click **"Use Current Tab URL"** automatically detects video links from your active browser tab.
- **🌐 99+ Languages**:
  - Full multilingual support with Automatic Language Detection.
- **📑 Multi-Format Subtitle Exports**:
  - Download `.txt` (Plain text).
  - Download `.srt` (Standard video subtitles with timestamps).
  - Download `.vtt` (WebVTT web captions).
  - One-click copy to clipboard.
- **🛡️ Crash-Resistant Offscreen Worker**:
  - Runs in a persistent Chrome Offscreen Document so transcription continues smoothly even if the popup is closed.

---

## 🚀 How to Install & Load in Google Chrome

### 1. Build the Extension
In your terminal, navigate to the `extension` directory and run:

```bash
cd extension
npm install
npm run build
```

This generates a ready-to-use unpacked extension inside `extension/dist/`.

### 2. Load into Chrome
1. Open Google Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click the **Load unpacked** button.
4. Select the `extension/dist` folder from this repository.
5. Scribe.txt icon 🎙️ will appear in your Chrome toolbar! Pin it for quick access.

---

## 🛠️ Tech Stack

- **Manifest**: Chrome Manifest V3
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Neo-Brutalism design system with Tailwind CSS
- **AI Engine**: `@xenova/transformers` (`Xenova/whisper-tiny` multilingual)
- **Audio Decoding**: WebAudio API (16kHz mono resampling)
- **Icons**: Lucide Icons
