import { useCallback, useEffect, useRef, useState } from "react";
import { useReadAloudPreferences } from "./useReadAloudPreferences";
import { useReadAloudEnvironment } from "./useReadAloudEnvironment";
import { playAudioBytes } from "../lib/read-aloud-audio";
import { type ResolvedPluginVoice } from "../lib/read-aloud-voice";
import { speakText, speechAvailable } from "../lib/read-aloud-speech";
import { createLogger } from "../../../platform/logger";
import type { TextUnitTarget } from "./useTextUnitNavigator";

const log = createLogger("read-aloud");

/** If stepping produces no new unit within this window, the book has ended. */
const ADVANCE_GUARD_MS = 6_000;

const unitKey = (unit: TextUnitTarget | null) =>
  unit ? `${unit.cfiRange ?? ""}::${unit.text}` : null;

type Handle = { cancel: () => void; pause: () => void; resume: () => void };

async function synthesizeBytes(
  voice: ResolvedPluginVoice,
  text: string,
): Promise<ArrayBuffer> {
  const raw = await voice.provider.synthesize({ text, voiceId: voice.voiceId });
  // decodeAudioData detaches its input; always hand over a private copy.
  return raw instanceof Uint8Array ? raw.slice().buffer : raw.slice(0);
}

/**
 * Read-aloud as autoplay for the text-unit navigator: speak the resting
 * unit, step on utterance end, and follow wherever the navigator goes — a
 * manual step or jump mid-playback simply restarts speech at the new unit.
 * The navigator keeps owning position, highlight, and persistence; this hook
 * owns nothing but the voice.
 *
 * The voice is a registered plugin voice when one exists (chosen once,
 * inside the providing plugin's own settings), the system speech engine
 * otherwise: the provider turns text into audio bytes, the host plays them,
 * and the NEXT unit's audio is prefetched while the current one plays so
 * cloud-synthesis latency hides between sentences. A failed provider call
 * falls back to the system voice for that unit — reading degrades, it does
 * not fall silent.
 */
export function useReadAloud({
  bookId,
  title,
  enabled,
  current,
  next,
  peekNext,
}: {
  bookId: string;
  title: string;
  /** The navigator mode is on and driving the engine. */
  enabled: boolean;
  current: TextUnitTarget | null;
  next: () => void;
  peekNext: () => string | null;
}) {
  const settings = useReadAloudPreferences(bookId);
  const pluginVoice = settings.pluginVoice;
  const optionsRef = useRef(settings);
  optionsRef.current = settings;
  const voiceKey =
    (pluginVoice
      ? pluginVoice.provider.key + ":" + pluginVoice.voiceId
      : settings.prefs.voice) +
    "|" +
    settings.prefs.rate;
  const epochRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const activeRef = useRef(false),
    pausedRef = useRef(false);
  activeRef.current = playing;
  pausedRef.current = paused;
  const handleRef = useRef<Handle | null>(null);
  const spokenKeyRef = useRef<string | null>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingAdvanceRef = useRef(false),
    deferredAdvanceRef = useRef(false);
  const voiceRef = useRef<ResolvedPluginVoice | null>(pluginVoice);
  voiceRef.current = pluginVoice;
  const prefetchRef = useRef<{ text: string; bytes: ArrayBuffer } | null>(null);
  const prefetchingRef = useRef<string | null>(null);
  const peekNextRef = useRef(peekNext);
  peekNextRef.current = peekNext;

  const stop = useCallback(() => {
    epochRef.current++;
    activeRef.current = false;
    waitingAdvanceRef.current = false;
    deferredAdvanceRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = null;
    handleRef.current?.cancel();
    handleRef.current = null;
    spokenKeyRef.current = null;
    prefetchRef.current = null;
    prefetchingRef.current = null;
    setPlaying(false);
  }, []);

  /** Best-effort: synthesize the upcoming unit into the single-slot cache. */
  const prefetchUpcoming = useCallback(() => {
    const voice = voiceRef.current;
    if (!voice) return;
    const upcoming = peekNextRef.current();
    if (
      !upcoming ||
      prefetchRef.current?.text === upcoming ||
      prefetchingRef.current === upcoming
    ) {
      return;
    }
    const epoch = epochRef.current;
    prefetchingRef.current = upcoming;
    synthesizeBytes(voice, upcoming)
      .then((bytes) => {
        if (epoch === epochRef.current && prefetchingRef.current === upcoming) {
          prefetchRef.current = { text: upcoming, bytes };
        }
      })
      .catch(() => {
        // The live path will retry (and fall back) when the unit arrives.
      })
      .finally(() => {
        if (epoch === epochRef.current && prefetchingRef.current === upcoming)
          prefetchingRef.current = null;
      });
  }, []);

  /** Speak one unit through the provider, system fallback on failure. */
  const speakUnit = useCallback(
    (
      text: string,
      callbacks: { onEnd: () => void; onError: () => void },
    ): Handle => {
      const voice = voiceRef.current;
      const options = {
        rate: optionsRef.current.prefs.rate,
        voice: optionsRef.current.systemVoice,
      };
      if (!voice)
        return speakText(
          text,
          { ...callbacks, onError: callbacks.onError },
          options,
        );

      let cancelled = false;
      let inner: Handle | null = null;
      const fallBack = (reason: unknown) => {
        // Degrading to the system voice must be AUDIBLE in the console, or a
        // misconfigured provider looks like it simply doesn't exist.
        log.warn("provider voice failed, using system voice", reason);
        if (cancelled) return;
        if (!speechAvailable()) {
          callbacks.onError();
          return;
        }
        inner = speakText(
          text,
          { ...callbacks, onError: callbacks.onError },
          options,
        );
        if (pausedRef.current) inner.pause();
      };
      void (async () => {
        try {
          const cached =
            prefetchRef.current?.text === text ? prefetchRef.current : null;
          if (cached) prefetchRef.current = null;
          const bytes = cached
            ? cached.bytes
            : await synthesizeBytes(voice, text);
          if (cancelled) return;
          inner = playAudioBytes(
            bytes,
            {
              onEnd: callbacks.onEnd,
              onError: fallBack,
            },
            options.rate,
          );
          if (pausedRef.current) inner.pause();
          prefetchUpcoming();
        } catch (error) {
          fallBack(error);
        }
      })();
      return {
        pause: () => inner?.pause(),
        resume: () => inner?.resume(),
        cancel: () => {
          cancelled = true;
          inner?.cancel();
        },
      };
    },
    [prefetchUpcoming],
  );

  useEffect(() => {
    epochRef.current++;
    prefetchRef.current = null;
    prefetchingRef.current = null;
    handleRef.current?.cancel();
    handleRef.current = null;
    spokenKeyRef.current = null;
    waitingAdvanceRef.current = false;
    deferredAdvanceRef.current = false;
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = null;
  }, [voiceKey]);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);
  useEffect(() => {
    stop();
  }, [bookId, stop]);
  // The playback loop: whenever we are playing and the resting unit is one
  // we have not spoken yet, speak it. Auto-advance and manual navigation
  // converge on this one path.
  useEffect(() => {
    if (!playing) return;
    if (paused) {
      if (unitKey(current) !== spokenKeyRef.current) {
        handleRef.current?.cancel();
        handleRef.current = null;
        spokenKeyRef.current = null;
        waitingAdvanceRef.current = false;
        deferredAdvanceRef.current = false;
      }
      return;
    }
    if (!enabled || !current?.text) {
      stop();
      return;
    }
    const key = unitKey(current);
    if (key === spokenKeyRef.current) return;
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = null;
    spokenKeyRef.current = key;
    waitingAdvanceRef.current = false;
    deferredAdvanceRef.current = false;
    handleRef.current?.cancel();
    const token = ++epochRef.current;
    handleRef.current = speakUnit(current.text, {
      onEnd: () => {
        if (token !== epochRef.current || !activeRef.current) return;
        handleRef.current = null;
        waitingAdvanceRef.current = true;
        deferredAdvanceRef.current = pausedRef.current;
        if (pausedRef.current) return;
        // Step forward; if no new unit arrives (end of book, or a section
        // that will not load), the guard closes playback instead of hanging.
        guardRef.current = setTimeout(stop, ADVANCE_GUARD_MS);
        next();
      },
      onError: () => {
        if (token === epochRef.current) stop();
      },
    });
  }, [playing, paused, enabled, current, next, speakUnit, stop, voiceKey]);

  useEffect(
    () => () => {
      activeRef.current = false;
      epochRef.current++;
      prefetchingRef.current = null;
      handleRef.current?.cancel();
      if (guardRef.current) clearTimeout(guardRef.current);
    },
    [],
  );

  const pause = useCallback(() => {
    if (!activeRef.current || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = null;
    handleRef.current?.pause();
  }, []);
  const resume = useCallback(() => {
    if (!activeRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    handleRef.current?.resume();
    if (waitingAdvanceRef.current) {
      guardRef.current = setTimeout(stop, ADVANCE_GUARD_MS);
      if (deferredAdvanceRef.current) {
        deferredAdvanceRef.current = false;
        next();
      }
    }
  }, [stop, next]);
  const toggle = useCallback(() => {
    if (playing) {
      if (paused) resume();
      else pause();
      return;
    }
    if (!enabled || (!speechAvailable() && !voiceRef.current)) return;
    activeRef.current = true;
    spokenKeyRef.current = null;
    setPlaying(true);
  }, [playing, paused, enabled, pause, resume]);
  const remaining = useReadAloudEnvironment({
    active: playing,
    paused,
    title,
    sleepMinutes: settings.prefs.sleepMinutes,
    stop,
    pause,
    resume,
    next,
  });
  return {
    available: speechAvailable() || pluginVoice !== null,
    playing,
    paused,
    toggle,
    stop,
    pause,
    resume,
    remaining,
    settings,
  };
}
