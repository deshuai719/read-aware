import { useEffect, useRef, useState } from "react";
/** Media controls, wall-clock sleep deadline, and a releasable screen wake lock. */
export function useReadAloudEnvironment({
  active,
  paused,
  title,
  sleepMinutes,
  stop,
  pause,
  resume,
  next,
}: {
  active: boolean;
  paused: boolean;
  title: string;
  sleepMinutes: number;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
}) {
  const deadline = useRef<number | null>(null),
    [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      deadline.current = null;
      setRemaining(null);
      return;
    }
    deadline.current =
      sleepMinutes > 0 ? Date.now() + sleepMinutes * 60000 : null;
    const tick = () => {
      const value = deadline.current;
      if (value === null) {
        setRemaining(null);
        return;
      }
      const left = Math.max(0, value - Date.now());
      setRemaining(Math.ceil(left / 60000));
      if (left === 0) stop();
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, sleepMinutes, stop]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!active || !session) return;
    if (typeof MediaMetadata !== "undefined")
      session.metadata = new MediaMetadata({ title });
    session.playbackState = paused ? "paused" : "playing";
    const actions: Partial<Record<MediaSessionAction, () => void>> = {
      play: resume,
      pause,
      stop,
      nexttrack: next,
    };
    for (const [action, handler] of Object.entries(actions)) {
      try {
        session.setActionHandler(action as MediaSessionAction, handler);
      } catch {}
    }
    return () => {
      for (const action of Object.keys(actions)) {
        try {
          session.setActionHandler(action as MediaSessionAction, null);
        } catch {}
      }
      session.playbackState = "none";
      session.metadata = null;
    };
  }, [active, paused, title, stop, pause, resume, next]);
  useEffect(() => {
    if (!active || paused) return;
    type Lock = {
      release: () => Promise<void>;
      addEventListener?: (name: string, listener: () => void) => void;
    };
    const wake = (
      navigator as Navigator & {
        wakeLock?: { request: (kind: string) => Promise<Lock> };
      }
    ).wakeLock;
    if (!wake) return;
    let disposed = false,
      pending = false,
      lock: Lock | null = null;
    const acquire = () => {
      if (disposed || document.visibilityState !== "visible" || lock || pending)
        return;
      pending = true;
      void wake
        .request("screen")
        .then((value) => {
          if (disposed || document.visibilityState !== "visible")
            void value.release().catch(() => {});
          else {
            lock = value;
            value.addEventListener?.("release", () => {
              if (lock === value) lock = null;
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          pending = false;
        });
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [active, paused]);
  return remaining;
}
