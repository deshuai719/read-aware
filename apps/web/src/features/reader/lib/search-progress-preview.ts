/** A search preview is not a durable reading position until accepted or returned. */
export function createSearchProgressPreview<T>() {
  let active = false;
  let pending: { bookId: string; progress: T } | null = null;
  return {
    begin() { if (!active) pending = null; active = true; },
    capture(bookId: string, progress: T): boolean {
      if (!active) return false;
      pending = { bookId, progress }; return true;
    },
    finish() { const value = pending; active = false; pending = null; return value; },
    reset() { active = false; pending = null; },
    get active() { return active; },
  };
}
