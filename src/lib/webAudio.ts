/**
 * Decodes any audio/video file (mp4, mov, mp3, wav, m4a) into 16kHz mono Float32Array
 * required by Whisper models using browser Web Audio API.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const rawArrayBuffer = await file.arrayBuffer();
  
  // Clone ArrayBuffer because decodeAudioData detaches the input buffer in Chrome/Edge
  const bufferCopy = rawArrayBuffer.slice(0);

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const audioCtx = new AudioCtx({ sampleRate: 16000 });

  try {
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      const promise = audioCtx.decodeAudioData(
        bufferCopy,
        (decoded) => resolve(decoded),
        (err) => reject(err || new Error("Unable to decode audio data"))
      );
      if (promise && typeof (promise as Promise<AudioBuffer>).then === "function") {
        (promise as Promise<AudioBuffer>).then(resolve).catch(reject);
      }
    });

    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (numOfChannels === 1) {
      const channelData = audioBuffer.getChannelData(0);
      await audioCtx.close().catch(() => {});
      return channelData;
    }

    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      mono[i] = (left[i] + right[i]) / 2;
    }

    await audioCtx.close().catch(() => {});
    return mono;
  } catch (err) {
    await audioCtx.close().catch(() => {});
    throw new Error(
      "Unable to decode audio data natively in browser. Falling back to server pipeline…"
    );
  }
}
