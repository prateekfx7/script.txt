/**
 * Decodes any audio/video file ArrayBuffer into 16kHz mono Float32Array
 * compatible with Whisper models.
 */
export async function decodeAudioToArray(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error("WebAudio API is not supported in this environment.");
  }

  // Use default AudioContext without sampleRate constraint to match hardware
  const audioCtx = new AudioCtx();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.error("decodeAudioData failure:", err);
    throw new Error(
      "Unable to extract audio track from this file. Please verify it is a valid .mp3, .wav, .m4a, or .mp4 file with audio."
    );
  } finally {
    if (audioCtx.state !== "closed") {
      await audioCtx.close().catch(() => {});
    }
  }

  if (!decodedBuffer || decodedBuffer.length === 0) {
    throw new Error("The selected audio file is empty.");
  }

  // Resample to exactly 16000Hz mono required by Whisper
  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const offlineCtx = new OfflineCtx(1, targetLength, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
