import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { generalSettingsAtom } from "../../../state/ui";
import {
  readLastReaderSession,
  resumableBook,
  saveLastReaderSession,
} from "../lib/session-resume";
import type { LibraryBook, Collection } from "../../library/lib/library-types";
/** One boot attempt; never re-open during a live session or defeat collection locking. */
export function useSessionResume({
  ready,
  books,
  collections,
  selected,
  loaded,
  open,
}: {
  ready: boolean;
  books: LibraryBook[];
  collections: Collection[];
  selected: LibraryBook | null;
  loaded: boolean;
  open: (book: LibraryBook) => void;
}) {
  const settings = useAtomValue(generalSettingsAtom),
    attempted = useRef(false),
    lastSelected = useRef<string | null>(null);
  useEffect(() => {
    if (attempted.current || !ready) return;
    attempted.current = true;
    if (selected || settings.startView !== "resume") return;
    const book = resumableBook(books, collections, readLastReaderSession());
    if (book) open(book);
  }, [ready, books, collections, selected, settings.startView, open]);
  useEffect(() => {
    if (!attempted.current) return;
    if (selected) {
      if (loaded) {
        lastSelected.current = selected.id;
        saveLastReaderSession(selected.id);
      }
    } else if (lastSelected.current) {
      lastSelected.current = null;
      saveLastReaderSession(null);
    }
  }, [selected?.id, loaded]);
}
