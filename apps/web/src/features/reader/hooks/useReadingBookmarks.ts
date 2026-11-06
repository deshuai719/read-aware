import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadingBookmark } from "@read-aware/core";
import { getDesktopBlobInfo } from "../../../platform/blob-store";
import { onAppEvent } from "../../../platform/app-events";
import { userDomain } from "../../../domain";
import type { LibraryBook } from "../../library/lib/library-types";
import type { ReadingCursor } from "../lib/reader-types";
import {
  subscribeToAppKeyDown,
  isEditableKeyTarget,
} from "../../../platform/app-keydown";
import { useTranslation } from "../../../i18n";
export function useReadingBookmarks(
  book: LibraryBook,
  cursor: ReadingCursor | null,
  enabled: boolean,
) {
  const { t } = useTranslation("reader");
  const [items, setItems] = useState<ReadingBookmark[]>([]),
    [sourceHash, setSourceHash] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const epoch = useRef(0),
    pending = useRef(false),
    latest = useRef({ book, cursor, enabled });
  latest.current = { book, cursor, enabled };
  const reload = useCallback(async () => {
    const id = book.id,
      token = ++epoch.current;
    try {
      const [next, source] = await Promise.all([
        userDomain.reading.queries.bookmarks.forBook(id),
        book.format === "virtual"
          ? Promise.resolve(null)
          : getDesktopBlobInfo(`bookfile:${id}`),
      ]);
      if (token === epoch.current) {
        setItems(next);
        setSourceHash(source?.sha256 ?? null);
        setError(null);
      }
    } catch {
      if (token === epoch.current) {
        setItems([]);
        setError(t("bookmarks.loadFailed"));
      }
    }
  }, [book.id, book.format, t]);
  useEffect(() => {
    setItems([]);
    setSourceHash(null);
    setError(null);
    void reload();
    const offs = [
      ...(
        ["bookmark.created", "bookmark.renamed", "bookmark.removed"] as const
      ).map((event) =>
        userDomain.reading.events.subscribe(event, () => void reload()),
      ),
      onAppEvent("library-changed", () => void reload()),
    ];
    return () => {
      epoch.current++;
      offs.forEach((off) => off());
    };
  }, [reload]);
  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      if (pending.current) return false;
      pending.current = true;
      setBusy(true);
      setError(null);
      const id = latest.current.book.id;
      try {
        await work();
        if (id === latest.current.book.id) await reload();
        return true;
      } catch {
        if (id === latest.current.book.id) setError(t("bookmarks.saveFailed"));
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [reload, t],
  );
  const add = useCallback(() => {
    const { book: current, cursor: snapshot, enabled: active } = latest.current;
    if (!active || !snapshot?.anchor) return Promise.resolve();
    return run(async () => {
      const existing = await userDomain.reading.queries.bookmarks.forBook(
        current.id,
      );
      if (existing.some((item) => item.anchor === snapshot.anchor)) return;
      await userDomain.reading.commands.bookmarks.add({
        bookId: current.id,
        anchor: snapshot.anchor!,
        title: snapshot.chapterTitle ?? current.title,
        excerpt: snapshot.visibleText ?? "",
        chapterHref: snapshot.chapter,
        fraction: snapshot.bookProgress,
        sourceSha256: sourceHash ?? undefined,
      });
    });
  }, [run, sourceHash]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!latest.current.enabled || isEditableKeyTarget(event.target)) return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        void add();
      }
    };
    return subscribeToAppKeyDown(key);
  }, [add]);
  return {
    items,
    sourceHash,
    busy,
    error,
    add,
    reload,
    canAdd: enabled && Boolean(cursor?.anchor),
    isSaved: items.some((item) => item.anchor === cursor?.anchor),
    rename: (id: string, title: string) =>
      run(() =>
        userDomain.reading.commands.bookmarks.rename(id, book.id, title),
      ),
    remove: (id: string) =>
      run(() => userDomain.reading.commands.bookmarks.remove(id, book.id)),
  };
}
