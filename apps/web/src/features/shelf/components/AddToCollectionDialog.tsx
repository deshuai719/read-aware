import { Plus, Prohibit } from "@phosphor-icons/react";
import { Body, Button, Dialog, TextField } from "@read-aware/ui";
import { useCollectionCreation } from "../hooks/useCollectionCreation";
import { useTranslation } from "../../../i18n";
import type { Collection } from "../../library/lib/library-types";
import { isCollectionLocked } from "../../library/lib/collection-lock";
import { useState } from "react";

type AddToCollectionDialogProps = {
  open: boolean;
  count: number;
  collections: Collection[];
  onClose: () => void;
  /** Assign the selected books to a collection (or null to ungroup them). */
  onAssign: (collectionId: string | null) => void | Promise<void>;
  /** Create a new collection; returns it (or null on failure). */
  onCreate: (name: string, password?: string) => Promise<Collection | null>;
};

/** Pick an existing collection, ungroup, or create a new one for the selection. */
export function AddToCollectionDialog({
  open,
  count,
  collections,
  onClose,
  onAssign,
  onCreate,
}: AddToCollectionDialogProps) {
  const { t } = useTranslation("shelf");
  const [assigning, setAssigning] = useState(false),
    [assignError, setAssignError] = useState<string | null>(null);
  const form = useCollectionCreation({
    open,
    onCreate,
    onCreated: async (collection) => {
      await onAssign(collection.id);
      onClose();
    },
  });
  const {
    name,
    password,
    busy: creating,
    setName,
    setPassword,
    create: createAndAssign,
  } = form;
  async function assign(id: string | null) {
    if (assigning || creating) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await onAssign(id);
      onClose();
    } catch {
      setAssignError(t("collectionDialog.assignFailed"));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!creating && !assigning) onClose();
      }}
      title={t("collectionDialog.title", { count })}
    >
      <div className="space-y-4">
        {(form.error || assignError) && (
          <Body role="alert" className="text-sm text-fg-muted">
            {form.error || assignError}
          </Body>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              label={t("collectionDialog.newLabel")}
              value={name}
              placeholder={t("collectionDialog.newPlaceholder")}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing)
                  void createAndAssign();
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void createAndAssign()}
            disabled={!name.trim() || creating}
          >
            <Plus size={15} weight="regular" aria-hidden="true" />
            {t("actions.create")}
          </Button>
        </div>
        <TextField
          label={t("collectionDialog.passwordLabel")}
          type="password"
          value={password}
          placeholder={t("collectionDialog.passwordPlaceholder")}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />

        {collections.length > 0 && (
          <div className="-mx-1 flex max-h-60 flex-col overflow-y-auto">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => void assign(collection.id)}
                disabled={
                  creating || assigning || isCollectionLocked(collection)
                }
                className="truncate rounded-md px-2 py-2 text-left font-sans text-sm text-fg transition-colors hover:bg-fg/5"
              >
                {collection.name}
              </button>
            ))}
          </div>
        )}

        <div className="-mx-1 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => void assign(null)}
            disabled={creating || assigning}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-sans text-sm text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <Prohibit size={15} weight="regular" aria-hidden="true" />
            {t("collectionDialog.removeFromCollection")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
