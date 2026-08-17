/**
 * Decodes any audio or video file in the browser into a 16kHz mono Float32Array
 * required by the on-device local Whisper model.
 * Uses OfflineAudioContext for universal browser compatibility.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const tempCtx = new AudioContextClass();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    await tempCtx.close().catch(() => {});
  }

  // Resample to exactly 16000Hz mono using OfflineAudioContext
  const targetSampleRate = 16000;
  const targetLength = Math.ceil(decodedBuffer.duration * targetSampleRate);

  const OfflineContextClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const offlineCtx = new OfflineContextClass(1, targetLength, targetSampleRate);

  // Mix down all channels to mono
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}
