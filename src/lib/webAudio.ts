/**
 * Decodes any audio or video file in the browser into a 16kHz mono Float32Array
 * required by the on-device PrateekAI / Whisper model.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const audioCtx = new AudioContextClass();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (decodeErr) {
    // If arrayBuffer decode fails directly (e.g. video container), try HTML5 Audio element
    try {
      decodedBuffer = await decodeViaMediaElement(file);
    } catch {
      await audioCtx.close();
      throw new Error(
        "Could not decode audio track. Please ensure the file contains valid audio (MP3, WAV, M4A, or MP4)."
      );
    }
  }

  // Resample to 16000Hz mono using OfflineAudioContext for Whisper
  const targetSampleRate = 16000;
  const numberOfChannels = 1;
  const targetLength = Math.max(
    1,
    Math.round(decodedBuffer.duration * targetSampleRate)
  );

  const OfflineContextClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  const offlineCtx = new OfflineContextClass(
    numberOfChannels,
    targetLength,
    targetSampleRate
  );

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = decodedBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  await audioCtx.close();

  return resampledBuffer.getChannelData(0);
}

/**
 * Fallback decoder using an HTML5 Audio/Blob URL
 */
async function decodeViaMediaElement(file: File): Promise<AudioBuffer> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.src = objectUrl;
    audio.preload = "auto";

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();

    const response = await fetch(objectUrl);
    const buf = await response.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf);
    await ctx.close();
    return decoded;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
