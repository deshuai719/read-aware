import { useState } from "react";
import { Body, Button, Dialog } from "@read-aware/ui";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";
import type { CollectionTileData } from "./CollectionTile";

type MergeTarget = { id: string; name: string; count: number };

type CollectionMergeDialogProps = {
  source: CollectionTileData;
  /** Every other collection the source may be folded into. */
  targets: MergeTarget[];
  onClose: () => void;
  onMerge: (targetId: string) => void;
  busy?: boolean;
};

/**
 * Fold one collection into another. Mainstream library behaviour: the books
 * move, the emptied collection disappears, nothing else changes — so the
 * dialog says exactly that instead of asking twice.
 */
export function CollectionMergeDialog({
  source,
  targets,
  onClose,
  onMerge,
  busy = false,
}: CollectionMergeDialogProps) {
  const { t } = useTranslation("shelf");
  const [targetId, setTargetId] = useState<string | null>(null);

  return (
    <Dialog open onClose={onClose} title={t("collection.mergeTitle", { name: source.name })}>
      <div className="space-y-4">
        <Body className="text-sm text-fg-muted">
          {t("collection.mergeBody", { count: source.count })}
        </Body>
        {targets.length === 0 ? (
          <Body className="text-sm text-fg-subtle">{t("collection.mergeNoTargets")}</Body>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => setTargetId(target.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm",
                  targetId === target.id
                    ? "border-fg bg-fill text-fg"
                    : "border-border text-fg-muted hover:border-fg-subtle",
                )}
              >
                <span className="truncate">{target.name}</span>
                <span className="shrink-0 font-sans text-xs tabular-nums text-fg-subtle">
                  {t("books", { count: target.count })}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!targetId || busy}
            onClick={() => targetId && onMerge(targetId)}
          >
            {t("collection.mergeConfirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
