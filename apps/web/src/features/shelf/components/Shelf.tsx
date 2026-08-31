import { useCallback, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { BookOpen, CheckCircle, FolderPlus, Info, Star, Trash } from "@phosphor-icons/react";
import { DropdownMenu, Eyebrow, Skeleton } from "@read-aware/ui";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";
import type {
  BookMetadataPatch,
  LibraryBook,
  ShelfSection as LibraryShelfSection,
} from "../../library/lib/library-types";
import type { ShelfLayout } from "../lib/shelf-view";
import { BookCover } from "./BookCover";
import { BookRow } from "./BookRow";
import { CollectionTile, type CollectionTileData } from "./CollectionTile";
import { BookDetailsDialog, BookRemoveDialog, BooksRemoveDialog } from "./BookDialogs";

type SectionBodyProps = {
  books: LibraryBook[];
  layout: ShelfLayout;
  /** Collection tiles rendered as peers ahead of the books (top-level only). */
  collections?: CollectionTileData[];
  pendingBookIds?: ReadonlySet<string>;
  onOpenCollection?: (id: string) => void;
  selecting?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (book: LibraryBook) => void;
  onRemove?: (book: LibraryBook) => void;
  onToggleStar?: (book: LibraryBook) => void;
  onUpdateMetadata?: (book: LibraryBook, patch: BookMetadataPatch) => void;
  onToggleSelect?: (book: LibraryBook) => void;
  /** Book currently being opened (spinner feedback on its cover). */
  openingBookId?: string | null;
  /** A book drag is in flight: tiles highlight and accept drops. */
  dragActive?: boolean;
  onDropOnCollection?: (collectionId: string) => void;
  onBookDragStart?: (ids: string[], event: DragEvent<HTMLButtonElement>) => void;
  /** Called when the drag ends (drop or cancel) — clears in-flight drag state. */
  onBookDragEnd?: () => void;
  /** Drop the dragged books onto this book to create a new collection. */
  onDropOnBook?: (bookId: string) => void;
  /** Right-click on a book tile (menu state lives in the shelf). */
  onBookContextMenu?: (event: MouseEvent<HTMLElement>, book: LibraryBook) => void;
  /** Right-click on a collection tile (menu state lives in the workspace). */
  onCollectionContextMenu?: (event: MouseEvent<HTMLElement>, data: CollectionTileData) => void;
};

function PendingBookPlaceholder({ layout }: { layout: ShelfLayout }) {
  if (layout === "list") {
    return (
      <div aria-hidden="true" className="flex items-center gap-4 rounded-sm px-2 py-2">
        <Skeleton variant="rectangular" className="h-16 w-11 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/5" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full max-w-32 justify-self-start space-y-2.5 sm:max-w-36 lg:max-w-44"
    >
      <Skeleton variant="rectangular" className="aspect-[2/3] w-full rounded-sm" />
      <Skeleton variant="text" className="w-3/4" />
    </div>
  );
}

function SectionBody({
  books,
  layout,
  collections = [],
  pendingBookIds,
  onOpenCollection,
  selecting,
  selectedIds,
  onSelect,
  onRemove,
  onToggleStar,
  onUpdateMetadata,
  onToggleSelect,
  openingBookId,
  dragActive = false,
  onDropOnCollection,
  onBookDragStart,
  onBookDragEnd,
  onDropOnBook,
  onBookContextMenu,
  onCollectionContextMenu,
}: SectionBodyProps) {
  const tiles = collections.map((data) => (
    <CollectionTile
      key={`collection-${data.id}`}
      data={data}
      layout={layout}
      onOpen={() => onOpenCollection?.(data.id)}
      onContextMenu={onCollectionContextMenu ? (event) => onCollectionContextMenu(event, data) : undefined}
      dragActive={dragActive}
      onDropBooks={onDropOnCollection}
    />
  ));

  // Dragging a selected book carries the whole selection; otherwise just the
  // book itself. Unselected books are not draggable while selection is active.
  const dragProps = (book: LibraryBook, selected: boolean) => {
    if (selecting && !selected) return { draggable: false, onDragStart: undefined };
    const ids = selecting && selected ? Array.from(selectedIds ?? []) : [book.id];
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLButtonElement>) => onBookDragStart?.(ids, event),
      onDragEnd: onBookDragEnd,
    };
  };

  if (layout === "list") {
    return (
      <div className="flex flex-col divide-y divide-border/60">
        {tiles}
        {books.map((book) => (
          pendingBookIds?.has(book.id) ? (
            <PendingBookPlaceholder key={book.id} layout={layout} />
          ) : (
            <BookRow
              key={book.id}
              book={book}
              selecting={selecting}
              selected={selectedIds?.has(book.id) ?? false}
              opening={book.id === openingBookId}
              onClick={() => onSelect?.(book)}
              onRemove={() => onRemove?.(book)}
              onToggleStar={() => onToggleStar?.(book)}
              onUpdateMetadata={(patch) => onUpdateMetadata?.(book, patch)}
              onToggleSelect={() => onToggleSelect?.(book)}
              onContextMenu={(event) => onBookContextMenu?.(event, book)}
              {...dragProps(book, selectedIds?.has(book.id) ?? false)}
              dragActive={dragActive}
              onDropOnBook={() => onDropOnBook?.(book.id)}
            />
          )
        ))}
      </div>
    );
  }

  return (
    // Above 2xl the fixed column steps hand over to auto-fill, so covers keep
    // flowing into new columns on any wider window instead of gaining gutters.
    <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 md:gap-x-6 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
      {tiles}
      {books.map((book) => (
        pendingBookIds?.has(book.id) ? (
          <PendingBookPlaceholder key={book.id} layout={layout} />
        ) : (
          <BookCover
            key={book.id}
            book={book}
            selecting={selecting}
            selected={selectedIds?.has(book.id) ?? false}
            opening={book.id === openingBookId}
            onClick={() => onSelect?.(book)}
            onRemove={() => onRemove?.(book)}
            onToggleStar={() => onToggleStar?.(book)}
            onUpdateMetadata={(patch) => onUpdateMetadata?.(book, patch)}
            onToggleSelect={() => onToggleSelect?.(book)}
            onContextMenu={(event) => onBookContextMenu?.(event, book)}
            {...dragProps(book, selectedIds?.has(book.id) ?? false)}
            dragActive={dragActive}
            onDropOnBook={() => onDropOnBook?.(book.id)}
          />
        )
      ))}
    </div>
  );
}

type ShelfProps = {
  sections: LibraryShelfSection[];
  layout: ShelfLayout;
  /** Collection tiles to lead the grid (top-level view only). */
  collections?: CollectionTileData[];
  /** Prepared imports rendered in their real sorted positions. */
  pendingBookIds?: ReadonlySet<string>;
  onOpenCollection?: (id: string) => void;
  selecting?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (book: LibraryBook) => void;
  onRemove?: (book: LibraryBook) => void;
  onToggleStar?: (book: LibraryBook) => void;
  onUpdateMetadata?: (book: LibraryBook, patch: BookMetadataPatch) => void;
  onToggleSelect?: (book: LibraryBook) => void;
  /** Book currently being opened (spinner feedback on its cover). */
  openingBookId?: string | null;
  /** A book drag is in flight: tiles highlight and accept drops. */
  dragActive?: boolean;
  onDropOnCollection?: (collectionId: string) => void;
  onBookDragStart?: (ids: string[], event: DragEvent<HTMLButtonElement>) => void;
  /** Called when the drag ends (drop or cancel) — clears in-flight drag state. */
  onBookDragEnd?: () => void;
  /** Drop the dragged books onto this book to create a new collection. */
  onDropOnBook?: (bookId: string) => void;
  /** Toggle a single book's finished state (context menu). */
  onToggleFinished?: (book: LibraryBook) => void;
  /** Open the add-to-collection flow for these books (context menu). */
  onAddToCollection?: (ids: string[]) => void;
  /** Bulk remove with the batch confirmation (multi-select context menu). */
  onBulkRemove?: (ids: string[]) => void;
  /** Right-click on a collection tile (menu state lives in the workspace). */
  onCollectionContextMenu?: (event: MouseEvent<HTMLElement>, data: CollectionTileData) => void;
  className?: string;
};

export function Shelf({
  sections,
  layout,
  collections = [],
  pendingBookIds,
  onOpenCollection,
  selecting,
  selectedIds,
  onSelect,
  onRemove,
  onToggleStar,
  onUpdateMetadata,
  onToggleSelect,
  openingBookId,
  dragActive = false,
  onDropOnCollection,
  onBookDragStart,
  onBookDragEnd,
  onDropOnBook,
  onToggleFinished,
  onAddToCollection,
  onBulkRemove,
  onCollectionContextMenu,
  className,
}: ShelfProps) {
  const { t } = useTranslation("shelf");
  // Right-click menu state: the viewport anchor plus the book the menu targets.
  const [bookMenu, setBookMenu] = useState<{
    x: number;
    y: number;
    book: LibraryBook;
  } | null>(null);
  // Dialogs opened from the menu (the per-tile dialogs inside BookCover/BookRow
  // stay reachable through their hover buttons; these are separate instances).
  const [detailsBook, setDetailsBook] = useState<LibraryBook | null>(null);
  const [removeBook, setRemoveBook] = useState<LibraryBook | null>(null);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);

  const handleBookContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>, book: LibraryBook) => {
      if (dragActive) return; // ignore right-clicks mid-drag
      event.preventDefault();
      setBookMenu({ x: event.clientX, y: event.clientY, book });
    },
    [dragActive],
  );

  // Menu target: right-clicked book alone, or — in selection mode — the whole
  // selection plus the right-clicked book (same semantics as dragging).
  const targets = useMemo(() => {
    if (!bookMenu) return null;
    if (!selecting || !selectedIds || selectedIds.size === 0) return [bookMenu.book.id];
    return [...new Set([...selectedIds, bookMenu.book.id])];
  }, [bookMenu, selecting, selectedIds]);

  const bookMenuItems = useMemo(() => {
    if (!bookMenu || !targets) return [];
    const { book } = bookMenu;
    const multi = targets.length > 1;
    const finished = book.readingStatus === "finished";
    return [
      !multi && {
        label: t("book.menu.open"),
        icon: <BookOpen size={14} weight="regular" aria-hidden="true" />,
        onClick: () => onSelect?.(book),
      },
      !multi && {
        label: book.starred ? t("book.menu.unstar") : t("book.menu.star"),
        icon: <Star size={14} weight={book.starred ? "fill" : "regular"} aria-hidden="true" />,
        onClick: () => onToggleStar?.(book),
      },
      !multi && {
        label: finished ? t("book.menu.markUnfinished") : t("book.menu.markFinished"),
        icon: <CheckCircle size={14} weight="regular" aria-hidden="true" />,
        onClick: () => onToggleFinished?.(book),
      },
      {
        label: t("book.menu.addToCollection"),
        icon: <FolderPlus size={14} weight="regular" aria-hidden="true" />,
        onClick: () => onAddToCollection?.(targets),
      },
      !multi && {
        label: t("book.menu.info"),
        icon: <Info size={14} weight="regular" aria-hidden="true" />,
        onClick: () => setDetailsBook(book),
      },
      {
        label: t("book.menu.remove"),
        icon: <Trash size={14} weight="regular" aria-hidden="true" />,
        onClick: () => {
          if (multi) setRemoveIds(targets);
          else setRemoveBook(book);
        },
        destructive: true,
      },
    ].filter((item): item is Exclude<typeof item, false> => Boolean(item));
  }, [bookMenu, targets, t, onSelect, onToggleStar, onToggleFinished, onAddToCollection, onRemove]);

  // Collections lead the first section so they sit in the same grid as the books;
  // when there are no book sections they get a section of their own.
  const effectiveSections =
    sections.length > 0
      ? sections
      : collections.length > 0
        ? [{ label: "", books: [] }]
        : [];

  return (
    <div className={cn(layout === "list" ? "space-y-8" : "space-y-12", className)}>
      {effectiveSections.map((section, index) => (
        <section
          key={section.label || `section-${index}`}
          style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}
        >
          {section.label && <Eyebrow className="mb-4 block">{section.label}</Eyebrow>}
          <SectionBody
            books={section.books}
            layout={layout}
            collections={index === 0 ? collections : []}
            pendingBookIds={pendingBookIds}
            onOpenCollection={onOpenCollection}
            selecting={selecting}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onRemove={onRemove}
            onToggleStar={onToggleStar}
            onUpdateMetadata={onUpdateMetadata}
            onToggleSelect={onToggleSelect}
            openingBookId={openingBookId}
            dragActive={dragActive}
            onDropOnCollection={onDropOnCollection}
            onBookDragStart={onBookDragStart}
            onBookDragEnd={onBookDragEnd}
            onDropOnBook={onDropOnBook}
            onBookContextMenu={handleBookContextMenu}
            onCollectionContextMenu={onCollectionContextMenu}
          />
        </section>
      ))}

      {bookMenu && (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) setBookMenu(null);
          }}
          position={{ x: bookMenu.x, y: bookMenu.y }}
          items={bookMenuItems}
        />
      )}
      {detailsBook && (
        <BookDetailsDialog
          book={detailsBook}
          open
          onClose={() => setDetailsBook(null)}
          onUpdateMetadata={(patch) => onUpdateMetadata?.(detailsBook, patch)}
        />
      )}
      {removeBook && (
        <BookRemoveDialog
          book={removeBook}
          open
          onClose={() => setRemoveBook(null)}
          onConfirm={() => {
            setRemoveBook(null);
            onRemove?.(removeBook);
          }}
        />
      )}
      {removeIds && (
        <BooksRemoveDialog
          count={removeIds.length}
          open
          onClose={() => setRemoveIds(null)}
          onConfirm={() => {
            setRemoveIds(null);
            onBulkRemove?.(removeIds);
          }}
        />
      )}
    </div>
  );
}
