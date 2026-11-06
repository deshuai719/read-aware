/** Encoded provider audio, one WebAudio source with pause/resume offset retention. */
let sharedContext: AudioContext | null = null;
export type AudioHandle = {
  cancel: () => void;
  pause: () => void;
  resume: () => void;
};
export function playAudioBytes(
  bytes: ArrayBuffer,
  callbacks: { onEnd: () => void; onError: (error: string) => void },
  rate = 1,
): AudioHandle {
  const context = (sharedContext ??= new AudioContext());
  void context.resume().catch(() => {});
  let cancelled = false,
    paused = false,
    buffer: AudioBuffer | null = null,
    source: AudioBufferSourceNode | null = null,
    offset = 0,
    startedAt = 0;
  const detach = () => {
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
      source = null;
    }
  };
  const start = () => {
    if (cancelled || paused || !buffer || source) return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(context.destination);
    startedAt = context.currentTime;
    source.onended = () => {
      source?.disconnect();
      source = null;
      if (!cancelled && !paused) callbacks.onEnd();
    };
    source.start(0, Math.min(offset, buffer.duration));
  };
  void context
    .decodeAudioData(bytes)
    .then((value) => {
      buffer = value;
      start();
    })
    .catch((error) => {
      if (!cancelled)
        callbacks.onError(
          error instanceof Error ? error.message : "audio decode failed",
        );
    });
  return {
    pause: () => {
      if (cancelled || paused) return;
      paused = true;
      if (source) offset += (context.currentTime - startedAt) * rate;
      detach();
    },
    resume: () => {
      if (cancelled || !paused) return;
      paused = false;
      void context
        .resume()
        .then(start)
        .catch((error) => {
          if (!cancelled) callbacks.onError(String(error));
        });
    },
    cancel: () => {
      cancelled = true;
      detach();
    },
  };
}
