/**
 * Thin wrapper over the webview's speechSynthesis for read-aloud.
 *
 * Quirk defenses baked in: the active utterance is kept referenced (some
 * engines garbage-collect a fire-and-forget utterance mid-speech and its
 * events never fire), and every new speak cancels the previous one so the
 * queue can never hold more than the current sentence. Pause/resume retains
 * the active utterance; cancellation silences late callbacks from old units.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export type SpeakHandle = {
  cancel: () => void;
  pause: () => void;
  resume: () => void;
};

export function speakText(
  text: string,
  callbacks: { onEnd: () => void; onError: (error: string) => void },
  options?: { rate?: number; voice?: SpeechSynthesisVoice },
): SpeakHandle {
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1;
  utterance.voice = options?.voice ?? null;
  activeUtterance = utterance;
  let settled = false;
  const settle = (fire: () => void) => {
    if (settled || activeUtterance !== utterance) return;
    settled = true;
    activeUtterance = null;
    fire();
  };
  utterance.onend = () => settle(callbacks.onEnd);
  utterance.onerror = (event) => {
    // Cancellation surfaces as an error event on some engines — that one is
    // ours and must not be reported as a failure.
    if (event.error === "canceled" || event.error === "interrupted") return;
    settle(() => callbacks.onError(String(event.error ?? "speech failed")));
  };
  synth.speak(utterance);

  return {
    pause: () => {
      if (!settled && activeUtterance === utterance) synth.pause();
    },
    resume: () => {
      if (!settled && activeUtterance === utterance) synth.resume();
    },
    cancel: () => {
      if (activeUtterance === utterance) {
        settled = true;
        activeUtterance = null;
        synth.cancel();
      }
    },
  };
}
