import { Prohibit } from "@phosphor-icons/react";
import { useState, type DragEvent } from "react";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";

type CollectionUngroupDropZoneProps = {
  /** Assign the dragged books to no collection (move them out of folders). */
  onDrop: () => void;
};

/**
 * Explicit "ungrouped" landing zone shown while a book drag is in flight.
 * Rendered by the library workspace above the shelf, so dropping here moves
 * the dragged books out of any collection. Only mounted during a book drag,
 * so OS file imports never collide with it.
 */
export function CollectionUngroupDropZone({ onDrop }: CollectionUngroupDropZoneProps) {
  const { t } = useTranslation("shelf");
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    onDrop();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "mb-6 flex items-center justify-center gap-3 rounded-md border-2 border-dashed border-border-strong px-4 py-5 text-fg-muted transition-colors",
        dragOver && "border-fg bg-fg/[0.04] text-fg",
      )}
    >
      <Prohibit size={18} weight="fill" aria-hidden="true" />
      <div className="text-center">
        <div className="font-sans text-sm font-medium">{t("dropZone.ungroupTitle")}</div>
        <div className="mt-0.5 font-sans text-xs">
          {dragOver ? t("dropZone.ungroupActive") : t("dropZone.ungroupHint")}
        </div>
      </div>
    </div>
  );
}