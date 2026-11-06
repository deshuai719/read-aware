import { Body, Button, Dialog, TextField } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import type { Collection } from "../../library/lib/library-types";
import { useCollectionCreation } from "../hooks/useCollectionCreation";
export function CreateCollectionDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, password?: string) => Promise<Collection | null>;
}) {
  const { t } = useTranslation("shelf"),
    form = useCollectionCreation({ open, onCreate, onCreated: onClose });
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!form.busy) onClose();
      }}
      title={t("collectionDialog.createOnly")}
    >
      <div className="space-y-4">
        <TextField
          autoFocus
          label={t("collectionDialog.newLabel")}
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing)
              void form.create();
          }}
        />
        <TextField
          label={t("collectionDialog.passwordLabel")}
          type="password"
          value={form.password}
          autoComplete="new-password"
          onChange={(e) => form.setPassword(e.target.value)}
          helperText={t("collectionDialog.passwordOptional")}
        />
        {form.error && (
          <Body role="alert" className="text-sm text-fg-muted">
            {form.error}
          </Body>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={form.busy} onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            disabled={form.busy || !form.name.trim()}
            onClick={() => void form.create()}
          >
            {t("actions.create")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
