import { useState } from "react";
import { BookmarkSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import { Body, Button, IconButton, Popover, TextField } from "@read-aware/ui";
import type { LibraryBook } from "../../library/lib/library-types";
import type { ReadingCursor } from "../lib/reader-types";
import { useTranslation, formatPercent } from "../../../i18n";
import { useReadingBookmarks } from "../hooks/useReadingBookmarks";
export function ReaderBookmarksPopover({
  book,
  cursor,
  enabled,
  onNavigate,
}: {
  book: LibraryBook;
  cursor: ReadingCursor | null;
  enabled: boolean;
  onNavigate: (anchor: string) => void;
}) {
  const { t } = useTranslation("reader"),
    marks = useReadingBookmarks(book, cursor, enabled),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="pointer-events-auto"
      triggerLabel={t("bookmarks.title")}
      triggerTooltip={t("bookmarks.title")}
      triggerClassName="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:text-fg focus-visible:ring-1 focus-visible:ring-fg"
      trigger={
        <BookmarkSimple size={18} weight={marks.isSaved ? "fill" : "regular"} />
      }
      panelClassName="flex max-h-[min(28rem,70vh)] w-[min(24rem,90vw)] flex-col gap-3 overflow-y-auto p-3"
    >
      <Button
        size="sm"
        variant="outline"
        disabled={marks.busy || !marks.canAdd || marks.isSaved}
        onClick={() => void marks.add()}
      >
        {t(marks.isSaved ? "bookmarks.saved" : "bookmarks.add")}
      </Button>
      {marks.error && (
        <Body role="alert" className="text-sm">
          {marks.error}
        </Body>
      )}
      {marks.items.length === 0 && (
        <Body className="py-4 text-center text-sm text-fg-muted">
          {t("bookmarks.empty")}
        </Body>
      )}
      {marks.items.map((mark) => {
        const stale = Boolean(
          mark.sourceSha256 &&
          marks.sourceHash &&
          mark.sourceSha256 !== marks.sourceHash,
        );
        return (
          <div key={mark.id} className="border-t border-border pt-2">
            {editing === mark.id ? (
              <div className="flex items-end gap-1">
                <TextField
                  label={t("bookmarks.name")}
                  value={draft}
                  maxLength={200}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={marks.busy}
                  onClick={() => {
                    void marks.rename(mark.id, draft).then((ok) => {
                      if (ok) setEditing(null);
                    });
                  }}
                >
                  {t("bookmarks.saveName")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start truncate"
                  disabled={stale}
                  onClick={() => {
                    onNavigate(mark.anchor);
                    setOpen(false);
                  }}
                >
                  {mark.title || t("bookmarks.untitled")}
                </Button>
                <IconButton
                  size="sm"
                  label={t("bookmarks.rename")}
                  icon={<PencilSimple size={15} />}
                  onClick={() => {
                    setEditing(mark.id);
                    setDraft(mark.title);
                  }}
                />
                <IconButton
                  size="sm"
                  label={t("bookmarks.remove")}
                  disabled={marks.busy}
                  icon={<Trash size={15} />}
                  onClick={() => void marks.remove(mark.id)}
                />
              </div>
            )}
            {stale && (
              <Body className="text-xs">{t("bookmarks.sourceChanged")}</Body>
            )}
            {mark.excerpt && (
              <Body className="line-clamp-2 text-xs text-fg-muted">
                {mark.excerpt}
              </Body>
            )}
            {mark.fraction !== undefined && (
              <Body className="mt-1 text-xs tabular-nums text-fg-subtle">
                {formatPercent(mark.fraction)}
              </Body>
            )}
          </div>
        );
      })}
    </Popover>
  );
}
