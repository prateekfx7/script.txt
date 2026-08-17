/**
 * Decodes any audio or video file in the browser into a 16kHz mono Float32Array
 * required by the on-device local Whisper model.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const audioCtx = new AudioContextClass({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);

  for (let i = 0; i < numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    for (let j = 0; j < length; j++) {
      mono[j] += channelData[j] / numberOfChannels;
    }
  }

  await audioCtx.close();
  return mono;
}
