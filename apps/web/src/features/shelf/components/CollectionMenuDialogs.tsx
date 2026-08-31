import { useState } from "react";
import { Button, Dialog, TextField } from "@read-aware/ui";
import { Trans, useTranslation } from "../../../i18n";
import type { CollectionTileData } from "./CollectionTile";

type CollectionRenameDialogProps = {
  collection: CollectionTileData;
  onClose: () => void;
  onRename: (name: string) => void;
};

/** Rename dialog opened from the collection context menu. */
export function CollectionRenameDialog({
  collection,
  onClose,
  onRename,
}: CollectionRenameDialogProps) {
  const { t } = useTranslation("shelf");
  const [name, setName] = useState(collection.name);
  const trimmed = name.trim();
  const unchanged = trimmed === collection.name;

  function commit() {
    if (!trimmed || unchanged) return;
    onRename(trimmed);
  }

  return (
    <Dialog open onClose={onClose} title={t("collection.renameAction")}>
      <div className="space-y-4">
        <TextField
          label={t("collection.nameLabel")}
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button variant="solid" size="sm" disabled={!trimmed || unchanged} onClick={commit}>
            {t("collection.rename")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

type CollectionDeleteDialogProps = {
  collection: CollectionTileData;
  onClose: () => void;
  onConfirm: () => void;
};

/** Delete-confirmation dialog opened from the collection context menu. */
export function CollectionDeleteDialog({
  collection,
  onClose,
  onConfirm,
}: CollectionDeleteDialogProps) {
  const { t } = useTranslation("shelf");
  return (
    <Dialog open onClose={onClose} title={t("collection.deleteTitle")}>
      <div className="space-y-4">
        <p>
          <Trans
            ns="shelf"
            i18nKey="collection.deleteBody"
            values={{ name: collection.name }}
            components={{ strong: <strong /> }}
          />
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {t("actions.delete")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
