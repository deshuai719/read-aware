/**
 * Hydrates book reference cards: bookId → live LibraryBook (cover data URL,
 * progress). A transcript can hold many stacks, so concurrent callers share one
 * in-flight listLibraryBooks() load. Returns null while loading; ids missing
 * from the map mean the book has left the shelf (cards fall back to their
 * persisted snapshot).
 */
import { useEffect, useState } from "react";
import { listCollections, listLibraryBooks } from "../../library/lib/library-db";
import { isBookInLockedCollection } from "../../library/lib/collection-lock";
import type { Collection, LibraryBook } from "../../library/lib/library-types";

let inFlight: Promise<{ books: LibraryBook[]; collections: Collection[] }> | null = null;

function loadShelfShared(): Promise<{ books: LibraryBook[]; collections: Collection[] }> {
  if (!inFlight) {
    inFlight = Promise.all([listLibraryBooks(), listCollections()])
      .then(([books, collections]) => ({ books, collections }))
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export type ReferenceBooks = {
  /** Live shelf records for visible (non-locked) books; null while loading. */
  hydrated: Map<string, LibraryBook> | null;
  /** Referenced ids whose collection is password-locked this session. */
  lockedBookIds: Set<string>;
};

export function useReferenceBooks(bookIds: string[]): ReferenceBooks {
  const [books, setBooks] = useState<Map<string, LibraryBook> | null>(null);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const key = bookIds.join("\n");

  useEffect(() => {
    let alive = true;
    void loadShelfShared().then(({ books: shelf, collections }) => {
      if (!alive) return;
      const wanted = new Set(key.split("\n").filter(Boolean));
      const locked = new Set<string>();
      const visible = new Map<string, LibraryBook>();
      for (const book of shelf) {
        if (!wanted.has(book.id)) continue;
        if (isBookInLockedCollection(book, collections)) {
          locked.add(book.id);
          continue;
        }
        visible.set(book.id, book);
      }
      setBooks(visible);
      setLockedIds(locked);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { hydrated: books, lockedBookIds: lockedIds };
}
