import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Body, ScrollArea, Spinner } from "@read-aware/ui";
import { formatPercent, useTranslation } from "../../../i18n";
import { MAX_SEARCH_RESULTS, type ReaderSearchApi } from "../hooks/useReaderSearch";

/** Auto-search delay after typing stops; Enter searches immediately. */
const SEARCH_DEBOUNCE_MS = 400;

type ReaderSearchPanelProps = {
  /** The panel's own open state (not the shell's `visible`): gating focus and
   *  the close/clear contract. */
  open: boolean;
  search: ReaderSearchApi;
  /** Bump to move focus to the input (a panel-intent "search" arrival). */
  focusRequestId: number;
  onSelect: (cfi: string) => void;
  onClose: () => void;
};

/**
 * The in-book search panel: query input (Enter / 400ms-debounced auto-search),
 * a per-section progress readout while the engine scans, and the result list
 * with the match rendered in bold highlight between the dimmed context. Clicking
 * a result jumps there (via the session's searchNavigationRequest channel).
 * Rendered inside the shell's dock layout (left on desktop, full-screen sheet
 * on phones), like the table of contents.
 */
export function ReaderSearchPanel({
  open,
  search,
  focusRequestId,
  onSelect,
  onClose,
}: ReaderSearchPanelProps) {
  const { t } = useTranslation("reader");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Focus the input when the panel opens (next frame, so the slide-in has
  // started) and on every explicit focus request (Ctrl+F while already open).
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [focusRequestId, open]);

  // Closing the panel drops any pending debounced search — the next open
  // starts from the empty state.
  useEffect(() => {
    if (!open && debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [open]);
  useEffect(() => () => {
    if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current);
  }, []);

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        search.runSearch(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [search.runSearch],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      search.setQuery(value);
      scheduleSearch(value);
    },
    [scheduleSearch, search.setQuery],
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        if (debounceTimerRef.current != null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        search.runSearch(search.query);
      } else if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose, search],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <input
          ref={inputRef}
          type="text"
          value={search.query}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          className="w-full rounded-md border border-border bg-fill px-2.5 py-1.5 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-1 focus-visible:ring-fg"
        />
      </div>

      {search.running && (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
          <Spinner size="sm" />
          <Body className="text-xs text-fg-muted">
            {t("search.running")}
            {search.progress != null ? ` · ${formatPercent(search.progress * 100)}` : ""}
          </Body>
        </div>
      )}

      <ScrollArea className="h-full min-h-0 flex-1">
        <div className="flex flex-col py-1">
          {!search.running && search.query.trim() !== "" && search.results.length === 0 && (
            <Body className="px-5 py-2 text-sm text-fg-muted">{t("search.noResults")}</Body>
          )}
          {search.results.map((item) => (
            <button
              key={item.cfi}
              type="button"
              onClick={() => onSelect(item.cfi)}
              className="w-full px-4 py-1.5 text-left text-[13px] leading-5 text-fg-muted transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg"
            >
              <span>{item.pre}</span>
              <mark className="rounded-[2px] bg-[#facc15]/35 px-0 font-semibold text-fg">
                {item.match}
              </mark>
              <span>{item.post}</span>
            </button>
          ))}
          {search.truncated && (
            <Body className="px-5 py-2 text-xs text-fg-subtle">
              {t("search.truncated", { count: MAX_SEARCH_RESULTS })}
            </Body>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
