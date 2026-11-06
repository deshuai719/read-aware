import { useEffect, useMemo, useRef, useState } from "react";
import { userDomain } from "../../../domain";
import { assertBookCollectionAccess } from "../../library/lib/collection-operations";
import {
  listLibraryBooks,
  listCollections,
} from "../../library/lib/library-db";
import { exportTextFile } from "../../../platform/export-file";
import { useTranslation } from "../../../i18n";
import {
  filterAnnotations,
  groupAnnotationsByChapter,
  exportAnnotations,
  type AnnotationFilter,
} from "../lib/annotation-management";
import type { Annotation, Highlight } from "../lib/annotation-types";
import type { TocEntry } from "../../reader/lib/reader-types";
export function useAnnotationManagement(
  bookId: string | undefined,
  bookTitle: string,
  items: Annotation[],
  toc: TocEntry[],
) {
  const { t } = useTranslation("reader"),
    [filter, setFilter] = useState<AnnotationFilter>({}),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [confirmRemove, setConfirmRemove] = useState(false);
  const pending = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setFilter({});
    setSelected(new Set());
    setError(null);
    setConfirmRemove(false);
  }, [bookId]);
  useEffect(() => {
    const live = new Set(items.map((m) => m.id));
    setSelected(
      (current) => new Set([...current].filter((id) => live.has(id))),
    );
  }, [items]);
  const filtered = useMemo(
    () => filterAnnotations(items, filter),
    [items, filter],
  );
  const groups = useMemo(
    () => groupAnnotationsByChapter(filtered, toc),
    [filtered, toc],
  );
  const selectedItems = items.filter((item) => selected.has(item.id));
  async function run(work: () => Promise<unknown>, clearSelection = true) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(null);
    const token = epoch.current;
    try {
      await work();
      if (token === epoch.current && clearSelection) setSelected(new Set());
      return true;
    } catch {
      if (token === epoch.current)
        setError(t("annotationTools.operationFailed"));
      return false;
    } finally {
      pending.current = false;
      if (token === epoch.current) setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return {
    filter,
    filtered,
    groups,
    selected,
    busy,
    error,
    toggle,
    confirmRemove,
    setConfirmRemove,
    setFilter,
    canRecolor:
      selectedItems.length > 0 &&
      selectedItems.every((m) => m.type === "highlight"),
    selectVisible: () => setSelected(new Set(filtered.map((m) => m.id))),
    clear: () => setSelected(new Set()),
    remove: () =>
      bookId
        ? run(() =>
            userDomain.annotations.commands.batch.remove(bookId, [...selected]),
          ).then((ok) => {
            if (ok) setConfirmRemove(false);
          })
        : Promise.resolve(),
    recolor: (color: Highlight["color"]) =>
      bookId
        ? run(() =>
            userDomain.annotations.commands.batch.recolor(
              bookId,
              [...selected],
              color,
            ),
          )
        : Promise.resolve(false),
    export: (format: "md" | "csv") =>
      run(async () => {
        if (bookId) {
          const [books, collections] = await Promise.all([
            listLibraryBooks(),
            listCollections(),
          ]);
          const book = books.find((b) => b.id === bookId);
          if (!book) throw new Error("annotation-book-not-found");
          assertBookCollectionAccess([book], collections);
        }
        const exportItems = selected.size ? selectedItems : filtered;
        await exportTextFile({
          filename:
            bookTitle.replace(/[<>:"/\\|?*]/g, "_") + "-annotations." + format,
          content: exportAnnotations(exportItems, toc, bookTitle, format),
          mimeType:
            format === "csv"
              ? "text/csv;charset=utf-8"
              : "text/markdown;charset=utf-8",
        });
      }, false),
  };
}
