/**
 * Decodes any audio/video file ArrayBuffer into 16kHz mono Float32Array
 * compatible with Whisper models.
 */
export async function decodeAudioToArray(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 16000 });

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

    // If browser AudioContext natively resampled to 16kHz
    if (audioBuffer.sampleRate === 16000 && audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }

    // Otherwise use OfflineAudioContext to guarantee 16kHz mono resampling
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * 16000),
      16000
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  } finally {
    if (audioCtx.state !== "closed") {
      await audioCtx.close().catch(() => {});
    }
  }
}
