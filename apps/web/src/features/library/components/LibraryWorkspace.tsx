import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Books, FolderOpen, LockOpen, LockSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import { Body, Button, DropdownMenu, EmptyState, Skeleton, useToast } from "@read-aware/ui";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";
import { userDomain } from "../../../domain";
import { Shelf } from "../../shelf/components/Shelf";
import { CollectionHeader } from "../../shelf/components/CollectionHeader";
import { AddToCollectionDialog } from "../../shelf/components/AddToCollectionDialog";
import { CollectionUngroupDropZone } from "../../shelf/components/CollectionUngroupDropZone";
import type { CollectionTileData } from "../../shelf/components/CollectionTile";
import { CollectionDeleteDialog, CollectionRenameDialog } from "../../shelf/components/CollectionMenuDialogs";
import { ShelfSelectionToolbar } from "../../shelf/components/ShelfSelectionToolbar";
import { deriveShelfView } from "../../shelf/lib/derive-shelf-view";
import { useShelfSelection } from "../../shelf/hooks/useShelfSelection";
import { activeCollectionAtom, shelfViewAtom } from "../../../state/ui";
import type { BookMetadataPatch, Collection, LibraryBook } from "../lib/library-types";
import { CollectionLockDialog, type CollectionLockMode } from "../../shelf/components/CollectionLockDialog";
import {
  hashCollectionPassword,
  isCollectionLocked,
  lockCollection,
  unlockCollection,
  verifyCollectionPassword,
} from "../lib/collection-lock";
import { setCollectionPassword } from "../lib/library-db";
import { formatLibraryError } from "../lib/format-library-error";
import { BOOK_DRAG_MIME } from "../lib/book-drag";

type LibraryWorkspaceProps = {
  isReady: boolean;
  books: LibraryBook[];
  /** Prepared imports whose files are not durable yet. */
  pendingBooks?: LibraryBook[];
  collections: Collection[];
  /** Book currently being opened (spinner feedback on its cover). */
  openingBookId?: string | null;
  /** Files currently in the import pipeline; also keeps an empty shelf out of its empty state. */
  importingCount?: number;
  onImport: () => void;
  onOpenBook: (book: LibraryBook) => void;
  onRemoveBook: (book: LibraryBook) => void;
  onToggleStar: (book: LibraryBook) => void;
  onUpdateBookMetadata: (book: LibraryBook, patch: BookMetadataPatch) => void;
  onBulkRemove: (ids: string[]) => void;
  onCreateCollection: (name: string) => Promise<Collection | null>;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onSetBooksCollection: (ids: string[], collectionId: string | null) => void;
};

export function LibraryWorkspace({
  isReady,
  books,
  pendingBooks = [],
  collections,
  openingBookId,
  importingCount = 0,
  onImport,
  onOpenBook,
  onRemoveBook,
  onToggleStar,
  onUpdateBookMetadata,
  onBulkRemove,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onSetBooksCollection,
}: LibraryWorkspaceProps) {
  const { t } = useTranslation("shelf");
  const shelfView = useAtomValue(shelfViewAtom);
  const [activeCollectionId, setActiveCollectionId] = useAtom(activeCollectionAtom);
  const { active, ids, selectedIds, exit, clear, toggle, selectAll } = useShelfSelection();
  const [showPendingBooks, setShowPendingBooks] = useState(false);
  const [lockTarget, setLockTarget] = useState<{ mode: CollectionLockMode; collection: Collection } | null>(null);
  // In-flight book drag (ids being dragged); non-null only during our own drags.
  const [dragBookIds, setDragBookIds] = useState<string[] | null>(null);
  // Books waiting to be assigned to a collection: from a drop-onto-book merge
  // or the shelf context menu's "Add to collection…".
  const [assignDialogIds, setAssignDialogIds] = useState<string[] | null>(null);
  // Collection context menu (tile right-click): viewport anchor plus the tile.
  const [collectionMenu, setCollectionMenu] = useState<{
    x: number;
    y: number;
    data: CollectionTileData;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<CollectionTileData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionTileData | null>(null);
  const dragActive = dragBookIds !== null;
  const { toast } = useToast();

  // Native imports normally finish before feedback is useful. Slow imports use
  // their fully prepared book record as a sorted placeholder, so the reserved
  // slot and the committed book's final slot are identical.
  useEffect(() => {
    if (pendingBooks.length === 0) {
      setShowPendingBooks(false);
      return;
    }
    if (books.length === 0) {
      setShowPendingBooks(true);
      return;
    }
    const timer = window.setTimeout(() => setShowPendingBooks(true), 450);
    return () => window.clearTimeout(timer);
  }, [books.length, pendingBooks.length]);

  const visiblePendingBooks = useMemo(
    () => books.length === 0 || showPendingBooks ? pendingBooks : [],
    [books.length, pendingBooks, showPendingBooks],
  );
  const pendingBookIds = useMemo(
    () => new Set(visiblePendingBooks.map((book) => book.id)),
    [visiblePendingBooks],
  );
  const shelfBooks = useMemo(
    () => [...books, ...visiblePendingBooks],
    [books, visiblePendingBooks],
  );

  const activeCollection = activeCollectionId
    ? collections.find((c) => c.id === activeCollectionId) ?? null
    : null;
  // Password-hidden folders render nothing (no covers, no books) until unlocked.
  const activeCollectionLocked = activeCollection ? isCollectionLocked(activeCollection) : false;

  // Pop back to the top level if the open collection was deleted.
  useEffect(() => {
    if (activeCollectionId && !collections.some((c) => c.id === activeCollectionId)) {
      setActiveCollectionId(null);
    }
  }, [activeCollectionId, collections, setActiveCollectionId]);

  // Leave selection mode if the library empties out from under it.
  useEffect(() => {
    if (active && books.length === 0) exit();
  }, [active, books.length, exit]);

  const visible = useMemo(
    () =>
      activeCollection
        ? activeCollectionLocked
          ? []
          : shelfBooks.filter((b) => b.collectionId === activeCollection.id)
        : shelfBooks.filter((b) => !b.collectionId),
    [activeCollection, activeCollectionLocked, shelfBooks],
  );

  const sections = deriveShelfView(visible, shelfView, t);

  // Collection tiles (top level only): true member counts and a cover montage.
  const collectionTiles: CollectionTileData[] = useMemo(() => {
    if (activeCollectionId) return [];
    const members = new Map<string, LibraryBook[]>();
    for (const book of books) {
      if (!book.collectionId) continue;
      const list = members.get(book.collectionId) ?? [];
      list.push(book);
      members.set(book.collectionId, list);
    }
    return collections.map((collection) => {
      const inside = members.get(collection.id) ?? [];
      return {
        id: collection.id,
        name: collection.name,
        count: inside.length,
        locked: isCollectionLocked(collection),
        coverUrls: inside
          .map((b) => b.coverUrl)
          .filter((url): url is string => Boolean(url))
          .slice(0, 4),
      };
    });
  }, [activeCollectionId, books, collections]);

  const collectionCount =
    activeCollection && !activeCollectionLocked
      ? books.filter((b) => b.collectionId === activeCollection.id).length
      : 0;

  /** Open a collection — unless it's password-locked, which routes to unlock. */
  const handleOpenCollection = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (!collection) return;
      if (isCollectionLocked(collection)) {
        setLockTarget({ mode: "unlock", collection });
        return;
      }
      setActiveCollectionId(id);
    },
    [collections, setActiveCollectionId],
  );

  const handleUnlock = async (password: string): Promise<boolean> => {
    const target = lockTarget;
    if (!target?.collection.passwordHash) return false;
    const ok = verifyCollectionPassword(target.collection.passwordHash, password);
    if (ok) {
      unlockCollection(target.collection.id);
      setActiveCollectionId(target.collection.id);
    }
    return ok;
  };

  const handleSetPassword = async (password: string | null): Promise<void> => {
    const target = lockTarget;
    if (!target) return;
    await setCollectionPassword(target.collection.id, password ? hashCollectionPassword(password) : null);
    lockCollection(target.collection.id);
  };

  const handleClearPassword = async (currentPassword: string): Promise<boolean> => {
    const target = lockTarget;
    if (!target?.collection.passwordHash) return false;
    const ok = verifyCollectionPassword(target.collection.passwordHash, currentPassword);
    if (ok) {
      await setCollectionPassword(target.collection.id, null);
      lockCollection(target.collection.id);
    }
    return ok;
  };

  const handleStartBookDrag = useCallback(
    (ids: string[], event: DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.setData(BOOK_DRAG_MIME, JSON.stringify(ids));
      event.dataTransfer.effectAllowed = "move";
      setDragBookIds(ids);
    },
    [],
  );

  const handleEndBookDrag = useCallback(() => setDragBookIds(null), []);

  // Safety net: clear the in-flight drag state whenever a drag actually ends,
  // even if WebView2 skipped the source element's dragend (drop outside a
  // handled target, cancelled drag, re-render unmounting the source). Without
  // this the drop zone/highlights can stay stuck in "dragging" mode.
  useEffect(() => {
    const clear = () => setDragBookIds(null);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);

  const handleDropOnCollection = useCallback(
    (collectionId: string) => {
      if (!dragBookIds || dragBookIds.length === 0) return;
      const ids = dragBookIds;
      setDragBookIds(null);
      onSetBooksCollection(ids, collectionId);
      const collection = collections.find((c) => c.id === collectionId);
      toast({ description: t("dropFeedback.added", { name: collection?.name ?? "" }) });
    },
    [dragBookIds, collections, onSetBooksCollection, toast, t],
  );

  const handleDropUngroup = useCallback(() => {
    if (!dragBookIds || dragBookIds.length === 0) return;
    const ids = dragBookIds;
    setDragBookIds(null);
    onSetBooksCollection(ids, null);
    toast({ description: t("dropFeedback.ungrouped") });
  }, [dragBookIds, onSetBooksCollection, toast, t]);

  /** Drop onto another book: merge dragged ids + target into a new collection. */
  const handleDropOnBook = useCallback(
    (targetBookId: string) => {
      if (!dragBookIds || dragBookIds.length === 0) return;
      const ids = [...new Set([...dragBookIds, targetBookId])];
      setDragBookIds(null);
      if (ids.length < 2) return; // dropping a book onto itself — nothing to merge
      setAssignDialogIds(ids);
    },
    [dragBookIds],
  );

  /**
   * Mark a single book finished/unread from the shelf context menu. The
   * reading domain emits `library-changed` after the write, so the list
   * refreshes through the same reload path as every other library mutation —
   * books arrive via props, so there is no local state to flip optimistically.
   */
  const handleToggleFinished = useCallback(
    (book: LibraryBook) => {
      const nextFinished = book.readingStatus !== "finished";
      void userDomain.reading.commands.setFinished(book.id, nextFinished).catch((error: unknown) => {
        toast({
          variant: "destructive",
          title: t("workspace.errorTitle"),
          description: formatLibraryError(error, t),
        });
      });
    },
    [toast, t],
  );

  /** Right-click on a collection tile opens the menu (ignored mid-drag). */
  const handleCollectionContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>, data: CollectionTileData) => {
      if (dragBookIds !== null) return;
      event.preventDefault();
      setCollectionMenu({ x: event.clientX, y: event.clientY, data });
    },
    [dragBookIds],
  );

  return (
    <div
      className={cn(
        "ra-motion-page-enter mx-auto flex min-h-full w-full flex-col px-6 pt-5 sm:pt-6",
        // The cover grid flows to fill any window; list rows keep a readable
        // measure instead of stretching across an ultra-wide monitor.
        shelfView.layout === "list" && "max-w-screen-2xl",
        // Extra bottom room so the floating selection bar never covers the last row.
        active ? "pb-28" : "pb-8 sm:pb-10",
      )}
    >
      {active && books.length > 0 && (
        <ShelfSelectionToolbar
          count={ids.length}
          total={visible.length}
          collections={collections}
          onSelectAll={() => selectAll(visible.map((book) => book.id))}
          onClear={clear}
          onAssignCollection={(collectionId) => {
            onSetBooksCollection(ids, collectionId);
            exit();
          }}
          onCreateCollection={onCreateCollection}
          onRemove={() => {
            onBulkRemove(ids);
            exit();
          }}
          onDone={exit}
        />
      )}

      {!isReady ? (
        // Skeleton shelf mirroring the real grid (see Shelf.tsx), so the load
        // reads as the shelf taking shape rather than a bare loading notice.
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 md:gap-x-6 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton variant="rectangular" className="aspect-[2/3] w-full rounded-sm" />
              <Skeleton variant="text" className="w-3/4" />
            </div>
          ))}
        </div>
      ) : books.length === 0 && importingCount === 0 ? (
        <div className="ra-motion-fade-in flex flex-1 items-center justify-center py-16">
          <EmptyState
            icon={<Books className="size-12 text-fg-subtle" weight="thin" />}
            title={t("workspace.emptyTitle")}
            action={(
              <Button size="sm" onClick={onImport}>
                {t("actions.import")}
              </Button>
            )}
          />
        </div>
      ) : (
        // Fades in over the skeleton it replaces (same grid geometry), so the
        // ready swap reads as the shelf resolving rather than a hard cut.
        <div className="ra-motion-fade-in">
          {activeCollection && (
            <CollectionHeader
              key={activeCollection.id}
              collection={activeCollection}
              count={collectionCount}
              onRename={(name) => onRenameCollection(activeCollection.id, name)}
              onManageLock={() => setLockTarget({ mode: "manage", collection: activeCollection })}
              onDelete={() => {
                onDeleteCollection(activeCollection.id);
                setActiveCollectionId(null);
              }}
            />
          )}

          {dragActive && !activeCollectionLocked && (
            <CollectionUngroupDropZone onDrop={handleDropUngroup} />
          )}

          {activeCollectionLocked ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <LockSimple size={32} weight="fill" aria-hidden="true" className="text-fg-muted" />
              <Body className="text-sm text-fg-muted">{t("collection.lockedEmpty")}</Body>
              <Button
                size="sm"
                onClick={() => {
                  if (activeCollection) setLockTarget({ mode: "unlock", collection: activeCollection });
                }}
              >
                {t("collection.lockUnlock")}
              </Button>
            </div>
          ) : visible.length === 0 && collectionTiles.length === 0 ? (
            <Body className="py-16 text-center text-sm text-fg-muted">
              {activeCollection ? t("workspace.emptyCollection") : t("workspace.nothingToShow")}
            </Body>
          ) : (
            <Shelf
              sections={sections}
              layout={shelfView.layout}
              collections={collectionTiles}
              pendingBookIds={pendingBookIds}
              openingBookId={openingBookId}
              onOpenCollection={handleOpenCollection}
              dragActive={dragActive}
              onDropOnCollection={handleDropOnCollection}
              onBookDragStart={handleStartBookDrag}
              onBookDragEnd={handleEndBookDrag}
              onDropOnBook={handleDropOnBook}
              selecting={active}
              selectedIds={selectedIds}
              onSelect={onOpenBook}
              onRemove={onRemoveBook}
              onToggleStar={onToggleStar}
              onUpdateMetadata={onUpdateBookMetadata}
              onToggleSelect={(book) => toggle(book.id)}
              onToggleFinished={handleToggleFinished}
              onAddToCollection={(ids) => setAssignDialogIds(ids)}
              onBulkRemove={onBulkRemove}
              onCollectionContextMenu={handleCollectionContextMenu}
            />
          )}
        </div>
      )}
      {assignDialogIds && (
        <AddToCollectionDialog
          open
          count={assignDialogIds.length}
          collections={collections}
          onClose={() => setAssignDialogIds(null)}
          onAssign={(collectionId) => {
            onSetBooksCollection(assignDialogIds, collectionId);
            setAssignDialogIds(null);
          }}
          onCreate={onCreateCollection}
        />
      )}
      {lockTarget && (
        <CollectionLockDialog
          open
          mode={lockTarget.mode}
          collection={lockTarget.collection}
          onClose={() => setLockTarget(null)}
          onUnlock={handleUnlock}
          onSetPassword={handleSetPassword}
          onClearPassword={handleClearPassword}
        />
      )}
      {collectionMenu && (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) setCollectionMenu(null);
          }}
          position={{ x: collectionMenu.x, y: collectionMenu.y }}
          items={[
            {
              label: t("collection.menu.open"),
              icon: <FolderOpen size={14} weight="regular" aria-hidden="true" />,
              onClick: () => handleOpenCollection(collectionMenu.data.id),
            },
            {
              label: t("collection.menu.rename"),
              icon: <PencilSimple size={14} weight="regular" aria-hidden="true" />,
              onClick: () => {
                setRenameTarget(collectionMenu.data);
                setCollectionMenu(null);
              },
            },
            collectionMenu.data.locked
              ? {
                  label: t("collection.menu.unlock"),
                  icon: <LockOpen size={14} weight="regular" aria-hidden="true" />,
                  onClick: () => {
                    const collection = collections.find((c) => c.id === collectionMenu.data.id);
                    if (collection) setLockTarget({ mode: "unlock", collection });
                    setCollectionMenu(null);
                  },
                }
              : {
                  label: t("collection.menu.manageLock"),
                  icon: <LockSimple size={14} weight="regular" aria-hidden="true" />,
                  onClick: () => {
                    const collection = collections.find((c) => c.id === collectionMenu.data.id);
                    if (collection) setLockTarget({ mode: "manage", collection });
                    setCollectionMenu(null);
                  },
                },
            {
              label: t("collection.menu.delete"),
              icon: <Trash size={14} weight="regular" aria-hidden="true" />,
              onClick: () => {
                setDeleteTarget(collectionMenu.data);
                setCollectionMenu(null);
              },
              destructive: true,
            },
          ]}
        />
      )}
      {renameTarget && (
        <CollectionRenameDialog
          collection={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={(name) => {
            onRenameCollection(renameTarget.id, name);
            setRenameTarget(null);
          }}
        />
      )}
      {deleteTarget && (
        <CollectionDeleteDialog
          collection={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeleteCollection(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
