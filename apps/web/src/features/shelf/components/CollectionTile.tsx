import { CaretRight, FolderSimple, LockSimple } from "@phosphor-icons/react";
import { useState, type DragEvent } from "react";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";
import type { ShelfLayout } from "../lib/shelf-view";

export type CollectionTileData = {
  id: string;
  name: string;
  count: number;
  /** Up to four member cover URLs for the montage (may be fewer). */
  coverUrls: string[];
  /** Folder is password-locked and not yet unlocked this session. */
  locked?: boolean;
};

type CollectionTileProps = {
  data: CollectionTileData;
  layout: ShelfLayout;
  onOpen: () => void;
  /** A book drag is in flight; tiles act as drop targets only then. */
  dragActive?: boolean;
  /** Assign the dragged books to this collection on drop. */
  onDropBooks?: (collectionId: string) => void;
};

/** A 2×2 montage of member covers, padded with blanks; a folder glyph when empty. */
function Montage({
  coverUrls,
  locked,
  className,
}: {
  coverUrls: string[];
  locked?: boolean;
  className?: string;
}) {
  if (locked) {
    return (
      <div className={cn("flex items-center justify-center bg-fill-strong text-fg-muted", className)}>
        <LockSimple size={26} weight="fill" aria-hidden="true" />
      </div>
    );
  }
  if (coverUrls.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-fg-subtle", className)}>
        <FolderSimple size={24} weight="regular" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 gap-px", className)}>
      {Array.from({ length: 4 }).map((_, i) =>
        coverUrls[i] ? (
          <img key={i} src={coverUrls[i]} loading="lazy" decoding="async" draggable={false} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={i} className="bg-fill-strong" />
        ),
      )}
    </div>
  );
}

/**
 * A collection rendered as a shelf peer — same footprint as a book, a montage of
 * its covers, and an always-on name/count label so it reads as a folder. Opens
 * the collection on click, and accepts dragged books as a drop target.
 */
export function CollectionTile({ data, layout, onOpen, dragActive = false, onDropBooks }: CollectionTileProps) {
  const { t } = useTranslation("shelf");
  const [dragOver, setDragOver] = useState(false);

  // Only intercept drag events for in-app book drags; OS file imports keep
  // flowing to the window-level importer (their types carry "Files", not ours).
  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (!dragActive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!dragActive) return;
    event.preventDefault();
    setDragOver(false);
    onDropBooks?.(data.id);
  };

  const dropHandlers = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };
  const dropHighlight = dragActive && dragOver
    ? "ring-2 ring-fg ring-offset-2 ring-offset-paper"
    : undefined;

  const countLabel = t("books", { count: data.count });
  const lockLabel = data.locked ? t("collection.lockedTooltip") : undefined;

  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        {...dropHandlers}
        aria-label={lockLabel ?? data.name}
        className={cn(
          "group flex w-full items-center gap-4 rounded-sm px-2 py-2 text-left transition-colors hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg",
          dropHighlight,
        )}
      >
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm border border-border bg-fill">
          <Montage coverUrls={data.coverUrls} locked={data.locked} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate font-serif text-sm font-medium text-fg">
            {data.locked && (
              <LockSimple size={12} weight="fill" aria-hidden="true" className="mr-1 inline -translate-y-px text-fg-muted" />
            )}
            {data.name}
          </span>
          <span className="mt-0.5 block font-sans text-[13px] tabular-nums text-fg-muted">
            {countLabel}
          </span>
        </div>
        <CaretRight size={16} weight="regular" aria-hidden="true" className="shrink-0 text-fg-subtle" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      {...dropHandlers}
      aria-label={lockLabel ?? data.name}
      className={cn(
        "group flex w-full max-w-32 justify-self-start flex-col text-left focus-visible:outline-none sm:max-w-36 lg:max-w-44",
        dropHighlight,
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm border border-border bg-fill transition-shadow group-hover:shadow-md group-focus-within:shadow-md">
        <Montage coverUrls={data.coverUrls} locked={data.locked} className="h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-stone-950/70 px-2 py-1.5">
          <span className="block truncate font-serif text-sm font-medium text-stone-50">
            {data.name}
          </span>
          <span className="mt-0.5 block font-sans text-[11px] tabular-nums text-stone-300">
            {countLabel}
          </span>
        </div>
        {data.locked && (
          <LockSimple
            size={18}
            weight="fill"
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 text-stone-100 drop-shadow"
          />
        )}
      </div>
    </button>
  );
}