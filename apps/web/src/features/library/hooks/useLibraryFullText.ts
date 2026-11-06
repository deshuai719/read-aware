import { useCallback, useEffect, useRef, useState } from "react";
import { userDomain } from "../../../domain";
import { onAppEvent } from "../../../platform/app-events";
import type { LibraryTextHit } from "../lib/library-full-text";
import type { LibraryBook } from "../lib/library-types";
import { useTranslation } from "../../../i18n";
import { createLogger } from "../../../platform/logger";
const log = createLogger("library-full-text");
export function useLibraryFullText(
  open: boolean,
  books: LibraryBook[],
  onNavigate: (book: LibraryBook, anchor: string) => void,
) {
  const { t } = useTranslation("reader"),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState<LibraryTextHit[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ scanned: 0, total: 0 }),
    [warnings, setWarnings] = useState(0),
    [limited, setLimited] = useState(false),
    [error, setError] = useState<string | null>(null);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const controller = useRef<AbortController | null>(null),
    epoch = useRef(0),
    current = useRef({ books, onNavigate });
  current.current = { books, onNavigate };
  const cancel = useCallback(() => {
    epoch.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
  }, []);
  useEffect(() => {
    if (!open) cancel();
    return cancel;
  }, [open, cancel]);
  useEffect(
    () =>
      onAppEvent("library-changed", () => {
        cancel();
        setHits([]);
      }),
    [cancel],
  );
  const search = useCallback(async () => {
    cancel();
    const token = epoch.current,
      abort = new AbortController();
    controller.current = abort;
    setHits([]);
    setProgress({ scanned: 0, total: 0 });
    setWarnings(0);
    setError(null);
    setLimited(false);
    setBusy(true);
    let finish: (() => void) | undefined;
    try {
      await tail.current.catch(() => {});
      if (token !== epoch.current || abort.signal.aborted) return;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      tail.current = finished;
      for await (const event of userDomain.library.queries.fullText.search(
        query,
        abort.signal,
      )) {
        if (token !== epoch.current || abort.signal.aborted) return;
        if (event.type === "hit") setHits((items) => [...items, event.hit]);
        else if (event.type === "progress") setProgress(event);
        else if (event.type === "warning") setWarnings((n) => n + 1);
        else if (event.type === "done") setLimited(event.limited);
      }
    } catch (cause) {
      log.error("Source scan failed", cause);
      if (token === epoch.current && !abort.signal.aborted)
        setError(t("librarySearch.failed"));
    } finally {
      finish?.();
      if (token === epoch.current) setBusy(false);
    }
  }, [query, cancel, t]);
  const navigate = async (hit: LibraryTextHit) => {
    try {
      const book = current.current.books.find((b) => b.id === hit.bookId);
      if (!book) return;
      const identity = await userDomain.reading.queries.sourceIdentity(book.id);
      if (identity.sourceSha256 !== hit.sourceSha256)
        throw new Error("source-changed");
      cancel();
      current.current.onNavigate(book, hit.cfi);
    } catch {
      setError(t("librarySearch.sourceChanged"));
    }
  };
  return {
    query,
    setQuery,
    hits,
    busy,
    progress,
    warnings,
    limited,
    error,
    search,
    cancel,
    navigate,
  };
}
