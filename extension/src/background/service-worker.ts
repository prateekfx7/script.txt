import { ExtensionMessage } from "../lib/messages";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

async function hasOffscreenDocument(): Promise<boolean> {
  // Check using getContexts if available (Chrome 116+)
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
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "On-device WebAssembly audio transcription",
    });
  } catch (err: unknown) {
    // If document already exists, ignore
    if (!(err instanceof Error && err.message.includes("Only a single offscreen document may be created"))) {
      console.error("Failed to create offscreen document:", err);
    }
  }
}

// Listen for messages from popup or offscreen
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "START_TRANSCRIBE") {
    (async () => {
      await ensureOffscreenDocument();
      // Set storage state
      await chrome.storage.local.set({
        is_transcribing: true,
        last_error: null,
      });
      // Forward to offscreen
      chrome.runtime.sendMessage(message);
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
    return true; // async sendResponse
  }
});
