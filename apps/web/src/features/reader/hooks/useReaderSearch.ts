/**
 * In-book full-text search. Streams the foliate engine's `view.search()`
 * generator into a flat result list, with an abort-safe run lifecycle (a newer
 * search — or `clear()` — supersedes the running one at its next yield), a hard
 * result cap so a huge book cannot stall the UI, and engine-highlight cleanup
 * on clear.
 *
 * Owned by ReaderWorkspace (the shell's search panel reads the same state), so
 * the engine element ref comes in as a parameter — the view that owns it lives
 * one level down.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FoliateSearchYield, FoliateView } from "../lib/foliate-engine";

/** Hard cap on collected results — beyond this the scan stops (truncated). */
export const MAX_SEARCH_RESULTS = 500;

export type ReaderSearchResultItem = {
  cfi: string;
  pre: string;
  match: string;
  post: string;
  sectionIndex: number;
};

/** The search panel's whole view of the search: state + actions. */
export type ReaderSearchApi = {
  query: string;
  results: ReaderSearchResultItem[];
  /** 0..1 fraction of the spine scanned so far (reported per section). */
  progress: number | null;
  running: boolean;
  /** True when MAX_SEARCH_RESULTS was reached mid-scan and the scan stopped. */
  truncated: boolean;
  /** Update the input text only (the panel's debounce decides when to search). */
  setQuery: (query: string) => void;
  runSearch: (query: string) => void;
  /** Cancel any running scan, clear engine highlights and all state. */
  clear: () => void;
};

type UseReaderSearchOptions = {
  viewRef: RefObject<FoliateView | null>;
  /** The open book's id — changing it cancels the previous book's search. */
  bookId: string | null;
};

export function useReaderSearch({
  viewRef,
  bookId,
}: UseReaderSearchOptions): ReaderSearchApi {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<ReaderSearchResultItem[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [truncated, setTruncated] = useState(false);
  // The streaming loop appends through this ref so it never reads a stale
  // closure over `results` while awaiting the next generator yield.
  const resultsRef = useRef<ReaderSearchResultItem[]>([]);
  // Every run (and clear) bumps this id. The running generator checks it after
  // each yield and abandons itself when superseded — the guard that stops a
  // cancelled search from appending into a newer one's results.
  const runIdRef = useRef(0);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
  }, []);

  const clear = useCallback(() => {
    // Bump first: any in-flight generator stops appending at its next yield.
    runIdRef.current += 1;
    viewRef.current?.clearSearch();
    setQueryState("");
    resultsRef.current = [];
    setResults([]);
    setProgress(null);
    setRunning(false);
    setTruncated(false);
  }, [viewRef]);

  const runSearch = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    const view = viewRef.current;
    // Claim the next run id BEFORE touching state, so an in-flight generator
    // (older query, or a clear) dies at its next yield instead of leaking into
    // this run's results.
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setQueryState(nextQuery);
    resultsRef.current = [];
    setResults([]);
    setProgress(null);
    setTruncated(false);
    if (!view || !trimmed) {
      setRunning(false);
      return;
    }
    setRunning(true);
    void (async () => {
      let generator: AsyncGenerator<FoliateSearchYield, void, unknown> | null = null;
      // The engine yields one `{progress}` per scanned section (spine order)
      // and `{label, subitems}` for sections with hits — counting the progress
      // yields tracks the section index of the next hit batch.
      let sectionIndex = -1;
      try {
        generator = view.search({ query: trimmed });
        while (true) {
          const { value, done } = await generator.next();
          if (done) break;
          if (runIdRef.current !== runId) {
            await generator.return();
            return;
          }
          if (typeof value === "string") break; // the 'done' sentinel
          if ("progress" in value) {
            sectionIndex += 1;
            setProgress(value.progress);
            continue;
          }
          if ("subitems" in value) {
            const items = value.subitems.map((subitem) => ({
              cfi: subitem.cfi,
              pre: subitem.excerpt.pre,
              match: subitem.excerpt.match,
              post: subitem.excerpt.post,
              sectionIndex: Math.max(0, sectionIndex),
            }));
            const remaining = MAX_SEARCH_RESULTS - resultsRef.current.length;
            if (remaining <= 0) {
              await generator.return();
              setTruncated(true);
              break;
            }
            const taken = items.slice(0, remaining);
            resultsRef.current = [...resultsRef.current, ...taken];
            setResults(resultsRef.current);
            if (items.length > taken.length) {
              await generator.return();
              setTruncated(true);
              break;
            }
          }
        }
      } catch {
        // A malformed section can reject a `next()` (unparseable CFI, …). Keep
        // whatever was already found instead of dropping the whole result set.
      } finally {
        if (runIdRef.current === runId) setRunning(false);
      }
    })();
  }, [viewRef]);

  // A new book — or the reader closing — cancels the previous book's scan and
  // clears its engine highlights. The unmount cleanup covers teardown paths
  // where bookId never changes first.
  useEffect(() => {
    clear();
  }, [bookId, clear]);
  useEffect(() => () => clear(), [clear]);

  return { query, results, progress, running, truncated, setQuery, runSearch, clear };
}
