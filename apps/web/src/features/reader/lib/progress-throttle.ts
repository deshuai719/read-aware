/** Per-book event cadence and ordered, awaitable durable progress writes. */
import type { BookProgress } from "../../library/lib/library-types";
type Scheduler = {
  schedule: (fn: () => void, ms: number) => number;
  cancel: (id: number) => void;
};
type BookState = {
  pending: BookProgress | undefined;
  timer: number | null;
  lastCommitAt: number | null;
  lastChapterHref: string | null;
  flight: Promise<void> | null;
  error: unknown;
  flushRequested: boolean;
};
export type ProgressThrottle = {
  queue: (bookId: string, progress: BookProgress) => void;
  flushAll: () => void;
  /** Wait for accepted positions, including writes queued during the drain. Failed writes remain retryable. */
  drain: (bookId?: string) => Promise<void>;
  dispose: () => void;
};
export function createProgressThrottle(
  commit: (
    bookId: string,
    progress: BookProgress,
  ) => unknown | Promise<unknown>,
  {
    commitIntervalMs = 30_000,
    debounceMs = 250,
    now = Date.now,
    scheduler = {
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (id) => window.clearTimeout(id),
    } as Scheduler,
  } = {},
): ProgressThrottle {
  const books = new Map<string, BookState>();
  function clearTimer(state: BookState) {
    if (state.timer !== null) {
      scheduler.cancel(state.timer);
      state.timer = null;
    }
  }
  function fire(id: string, state: BookState) {
    clearTimer(state);
    if (state.pending === undefined) return;
    if (state.flight) {
      state.flushRequested = true;
      return;
    }
    const value = state.pending;
    state.pending = undefined;
    state.error = null;
    state.flushRequested = false;
    const previousTime = state.lastCommitAt,
      previousChapter = state.lastChapterHref;
    state.lastCommitAt = now();
    state.lastChapterHref = value?.href ?? null;
    const fail = (error: unknown) => {
      state.error = error;
      state.lastCommitAt = previousTime;
      state.lastChapterHref = previousChapter;
      if (state.pending === undefined) state.pending = value;
    };
    try {
      const work = commit(id, value);
      if (work && typeof (work as PromiseLike<unknown>).then === "function") {
        state.flight = Promise.resolve(work)
          .then(() => {}, fail)
          .finally(() => {
            state.flight = null;
            if (state.flushRequested && !state.error) fire(id, state);
          });
      }
    } catch (error) {
      fail(error);
    }
  }
  return {
    queue(id, value) {
      let state = books.get(id);
      if (!state) {
        state = {
          pending: undefined,
          timer: null,
          lastCommitAt: null,
          lastChapterHref: null,
          flight: null,
          error: null,
          flushRequested: false,
        };
        books.set(id, state);
      }
      state.pending = value;
      const boundary =
        state.lastCommitAt === null ||
        (value?.href ?? null) !== state.lastChapterHref;
      const due = boundary
        ? debounceMs
        : Math.max(
            debounceMs,
            (state.lastCommitAt ?? 0) + commitIntervalMs - now(),
          );
      clearTimer(state);
      state.timer = scheduler.schedule(() => fire(id, state!), due);
    },
    flushAll() {
      for (const [id, state] of books) fire(id, state);
    },
    async drain(bookId) {
      const selected = () =>
        [...books].filter(([id]) => bookId == null || id === bookId);
      for (const [, state] of selected()) state.error = null;
      while (true) {
        const states = selected();
        for (const [id, state] of states) fire(id, state);
        await Promise.all(states.map(([, state]) => state.flight));
        const failure = states.find(([, state]) => state.error != null);
        if (failure) throw failure[1].error;
        if (
          selected().every(
            ([, state]) => state.pending === undefined && !state.flight,
          )
        )
          return;
      }
    },
    dispose() {
      for (const [id, state] of books) fire(id, state);
    },
  };
}
