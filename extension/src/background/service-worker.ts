import { ExtensionMessage } from "../lib/messages";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
let isOffscreenReady = false;

async function hasOffscreenDocument(): Promise<boolean> {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
  }
  return false;
}

async function ensureOffscreenDocument() {
  const exists = await hasOffscreenDocument();
  if (exists) return;

  try {
    isOffscreenReady = false;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "On-device WebAssembly audio transcription",
    });
  } catch (err: unknown) {
    if (!(err instanceof Error && err.message.includes("Only a single offscreen document may be created"))) {
      console.error("Failed to create offscreen document:", err);
    }
  }
}

// Pre-warm offscreen document on service worker start
ensureOffscreenDocument().catch(() => {});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_READY") {
    isOffscreenReady = true;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "START_TRANSCRIBE" && message.target !== "offscreen") {
    (async () => {
      await ensureOffscreenDocument();

      // Set storage state
      await chrome.storage.local.set({
        is_transcribing: true,
        last_error: null,
      });

      // Wait until offscreen announces ready (up to 3s)
      let retries = 0;
      while (!isOffscreenReady && retries < 30) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }

      // Forward to offscreen with target flag to prevent double execution
      chrome.runtime.sendMessage({
        ...message,
        target: "offscreen",
      });
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "GET_CURRENT_STATE") {
    chrome.storage.local.get(["is_transcribing", "latest_transcript", "last_error"], (data) => {
      sendResponse({
        type: "CURRENT_STATE_RESPONSE",
        isTranscribing: !!data.is_transcribing,
        latestResult: data.latest_transcript,
        error: data.last_error,
      });
    });
    return true;
  }
});
