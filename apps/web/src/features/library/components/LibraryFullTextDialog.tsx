import {
  Body,
  Button,
  Caption,
  Dialog,
  SearchField,
  Spinner,
} from "@read-aware/ui";
import { LibraryTextResult } from "./LibraryTextResult";
import { useTranslation } from "../../../i18n";
import { useLibraryFullText } from "../hooks/useLibraryFullText";
import type { LibraryBook } from "../lib/library-types";
export function LibraryFullTextDialog({
  open,
  onClose,
  books,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  books: LibraryBook[];
  onNavigate: (book: LibraryBook, anchor: string) => void;
}) {
  const { t } = useTranslation("reader"),
    scan = useLibraryFullText(open, books, (book, anchor) => {
      onNavigate(book, anchor);
      onClose();
    });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("librarySearch.title")}
      className="w-[min(48rem,94vw)]"
    >
      <div className="flex max-h-[75vh] flex-col gap-4">
        <Caption>{t("librarySearch.localOnly")}</Caption>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void scan.search();
          }}
        >
          <SearchField
            label={t("librarySearch.query")}
            value={scan.query}
            onChange={(e) => scan.setQuery(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={scan.busy || scan.query.trim().length < 2}
          >
            {t("librarySearch.start")}
          </Button>
          {scan.busy && (
            <Button variant="ghost" onClick={scan.cancel}>
              {t("librarySearch.cancel")}
            </Button>
          )}
        </form>
        <Caption aria-live="polite">
          {t("librarySearch.progress", {
            scanned: scan.progress.scanned,
            total: scan.progress.total,
            count: scan.hits.length,
          })}
        </Caption>
        {scan.busy && <Spinner size="sm" />}
        {scan.error && <Body role="alert">{scan.error}</Body>}
        {scan.warnings > 0 && (
          <Caption>
            {t("librarySearch.partial", { count: scan.warnings })}
          </Caption>
        )}
        {scan.limited && <Caption>{t("librarySearch.limited")}</Caption>}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          aria-label={t("librarySearch.title")}
        >
          {scan.hits.map((hit) => (
            <LibraryTextResult
              key={hit.bookId + hit.cfi}
              hit={hit}
              onSelect={() => void scan.navigate(hit)}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("librarySearch.close")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
