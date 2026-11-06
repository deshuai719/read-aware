import { cn } from "@read-aware/ui/cn";
import {
  ArrowUUpLeft,
  CaretDown,
  CaretUp,
  Check,
  DotsThree,
  X,
} from "@phosphor-icons/react";
import {
  Body,
  Button,
  DropdownMenu,
  IconButton,
  Spinner,
  TextField,
} from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import { useReaderFindBar } from "../hooks/useReaderFindBar";
import { type ReaderSearchApi } from "../hooks/useReaderSearch";
import { ReaderSearchResults } from "./ReaderSearchResults";

type Props = {
  open: boolean;
  search: ReaderSearchApi;
  focusRequestId: number;
  onClose: () => void;
  belowChrome?: boolean;
  clearWindowControls?: boolean;
};
/** Familiar page-find: one row, explicit secondary surfaces, transient background markers. */
export function ReaderSearchBar(props: Props) {
  const {
    open,
    search,
    onClose,
    belowChrome = false,
    clearWindowControls = false,
  } = props;
  const { t } = useTranslation("reader");
  const bar = useReaderFindBar(props);
  if (!open) return null;
  const count = search.results.length;
  const position = search.activeIndex >= 0 ? search.activeIndex + 1 : 0;
  const finished = bar.currentResults && !search.running;
  return (
    <div
      ref={bar.containerRef}
      role="search"
      aria-label={t("search.label")}
      onKeyDown={bar.keyDown}
      data-reader-find-bar
      style={
        clearWindowControls && !belowChrome
          ? { right: "calc(132px + 0.75rem)", maxWidth: "calc(100vw - 156px)" }
          : undefined
      }
      className={cn(
        "pointer-events-auto fixed right-3 z-30 w-[min(360px,calc(100vw-1.5rem))] rounded-md border border-border bg-[var(--ra-main-surface-color)] shadow-sm",
        belowChrome
          ? "top-[calc(var(--ra-safe-top,0px)+3.5rem)]"
          : "top-[calc(var(--ra-safe-top,0px)+0.5rem)]",
      )}
    >
      <div
        data-reader-find-row
        className="flex h-9 items-center gap-0.5 px-1.5"
      >
        <TextField
          ref={bar.inputRef}
          label=""
          aria-label={t("search.label")}
          value={search.query}
          placeholder={t(
            search.options.scope === "chapter"
              ? "search.placeholderChapter"
              : "search.placeholder",
          )}
          variant="underline"
          maxLength={500}
          className="min-w-0 flex-1 [&_input]:h-7 [&_input]:border-0 [&_input]:px-1 [&_input]:py-0 [&_input]:text-sm [&_input]:shadow-none"
          onChange={(event) => bar.change(event.target.value)}
          onKeyDown={bar.inputKeyDown}
          onCompositionStart={bar.compositionStart}
          onCompositionEnd={(event) =>
            bar.compositionEnd(event.currentTarget.value)
          }
        />
        {search.query.trim() && (
          <Button
            size="sm"
            variant="ghost"
            disabled={
              !bar.currentResults ||
              (!bar.hasResults &&
                !search.complete &&
                !search.warningIndices.length)
            }
            onClick={bar.toggleResults}
            aria-expanded={bar.resultsOpen}
            aria-label={t("search.showResults")}
            title={t("search.showResults")}
            className="h-7 shrink-0 px-1 font-sans text-xs tabular-nums"
          >
            {count
              ? position +
                "/" +
                count +
                (search.hasMore ||
                search.limitReached ||
                search.warningIndices.length ||
                search.error
                  ? "+"
                  : "")
              : search.error
                ? t("search.failedShort")
                : search.warningIndices.length
                  ? t("search.incompleteShort")
                  : finished
                    ? t("search.noResultsShort")
                    : "…"}
          </Button>
        )}
        {search.running && <Spinner size="sm" />}
        <IconButton
          size="sm"
          label={t("search.previous")}
          disabled={!bar.hasResults || !search.isReady()}
          onClick={() => bar.step(-1)}
          icon={<CaretUp size={14} aria-hidden="true" />}
        />
        <IconButton
          size="sm"
          label={t("search.next")}
          disabled={!bar.hasResults || !search.isReady()}
          onClick={() => bar.step(1)}
          icon={<CaretDown size={14} aria-hidden="true" />}
        />
        {search.canReturn && (
          <IconButton
            size="sm"
            label={t("search.returnToPosition")}
            onClick={() => {
              search.returnToPosition();
              onClose();
            }}
            icon={<ArrowUUpLeft size={14} aria-hidden="true" />}
          />
        )}
        <DropdownMenu
          align="right"
          triggerLabel={t("search.options")}
          open={bar.optionsOpen}
          onOpenChange={bar.setOptionsOpen}
          className="shrink-0 [&>button]:h-7 [&>button]:w-6 [&>button]:items-center [&>button]:justify-center"
          trigger={<DotsThree size={16} aria-hidden="true" />}
          items={[
            {
              label: t("search.modePhrase"),
              icon:
                search.options.mode === "phrase" ? (
                  <Check size={14} />
                ) : undefined,
              onClick: () => bar.changeOptions({ mode: "phrase" }),
            },
            {
              label: t("search.modeAll"),
              icon:
                search.options.mode === "all" ? <Check size={14} /> : undefined,
              onClick: () => bar.changeOptions({ mode: "all" }),
            },
            {
              label: t("search.scopeBook"),
              icon:
                search.options.scope === "book" ? (
                  <Check size={14} />
                ) : undefined,
              onClick: () => bar.changeOptions({ scope: "book" }),
            },
            {
              label: t("search.scopeChapter"),
              icon:
                search.options.scope === "chapter" ? (
                  <Check size={14} />
                ) : undefined,
              onClick: () => bar.changeOptions({ scope: "chapter" }),
            },
            {
              label: t("search.matchCase"),
              icon: search.options.matchCase ? <Check size={14} /> : undefined,
              onClick: () =>
                bar.changeOptions({ matchCase: !search.options.matchCase }),
            },
            {
              label: t("search.matchWholeWords"),
              icon: search.options.matchWholeWords ? (
                <Check size={14} />
              ) : undefined,
              onClick: () =>
                bar.changeOptions({
                  matchWholeWords: !search.options.matchWholeWords,
                }),
            },
            {
              label: t("search.keyboardHint"),
              disabled: true,
              onClick: () => {},
            },
          ]}
        />
        <IconButton
          size="sm"
          label={t("search.close")}
          onClick={onClose}
          icon={<X size={14} aria-hidden="true" />}
        />
        <span className="sr-only" aria-live="polite">
          {search.wrappedDirection
            ? t(search.complete ? "search.wrapped" : "search.wrappedLoaded")
            : search.running
              ? t("search.running")
              : finished
                ? t("search.position", { position, total: count })
                : ""}
        </span>
      </div>
      {search.error && (
        <div
          role="alert"
          className="flex items-center justify-between px-2 py-1"
        >
          <Body className="text-xs text-fg-muted">{t("search.failed")}</Body>
          <Button
            size="sm"
            variant="link"
            onClick={() =>
              void search.runSearch(search.query, { navigate: false })
            }
          >
            {t("search.retry")}
          </Button>
        </div>
      )}
      {bar.resultsOpen && bar.currentResults && (
        <ReaderSearchResults search={search} onSelect={bar.select} />
      )}
    </div>
  );
}
