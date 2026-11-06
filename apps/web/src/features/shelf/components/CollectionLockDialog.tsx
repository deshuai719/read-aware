/**
 * Folder-lock dialog for collections: "unlock" asks for the folder password
 * before the shelf can open it; "manage" sets/changes the password or clears
 * it (clearing requires the current password). Passwords are Argon2id-hashed
 * client-side and synced via `collection.passwordChanged`; the hash itself
 * is never shown.
 */
import { LockSimple, LockKey, LockOpen } from "@phosphor-icons/react";
import { Button, Body, Caption, Dialog, TextField } from "@read-aware/ui";
import { useCollectionLockForm } from "../hooks/useCollectionLockForm";
import { useTranslation } from "../../../i18n";
import type { Collection } from "../../library/lib/library-types";

export type CollectionLockMode = "unlock" | "manage";

type CollectionLockDialogProps = {
  open: boolean;
  mode: CollectionLockMode;
  collection: Collection | null;
  onClose: () => void;
  /** Verify the password; true when it opened the folder. */
  onUnlock: (password: string) => Promise<boolean>;
  /** Set a new/changed password (null clears — only after current-password verification). */
  onSetPassword: (
    password: string,
    currentPassword: string,
  ) => Promise<boolean>;
  /** Verify the current password, then clear the lock. */
  onClearPassword: (password: string) => Promise<boolean>;
};

export function CollectionLockDialog({
  open,
  mode,
  collection,
  onClose,
  onUnlock,
  onSetPassword,
  onClearPassword,
}: CollectionLockDialogProps) {
  const { t } = useTranslation("shelf");
  const form = useCollectionLockForm({
    open,
    collectionId: collection?.id,
    onClose,
    onUnlock,
    onSetPassword,
    onClearPassword,
  });
  const {
    password,
    newPassword,
    error,
    busy,
    setPassword,
    setNewPassword,
    submitUnlock,
    submitSet,
    submitClear,
  } = form;
  const locked = Boolean(collection?.passwordHash),
    isUnlock = mode === "unlock";

  return (
    <Dialog
      open={open}
      onClose={form.close}
      title={
        isUnlock
          ? t("collection.lockUnlockTitle")
          : t("collection.lockManageTitle")
      }
    >
      <div className="space-y-4">
        {collection && (
          <Caption className="flex items-center gap-2 text-fg-muted">
            {isUnlock ? (
              <LockSimple size={15} weight="fill" aria-hidden="true" />
            ) : locked ? (
              <LockKey size={15} weight="fill" aria-hidden="true" />
            ) : (
              <LockOpen size={15} weight="fill" aria-hidden="true" />
            )}
            {collection.name}
          </Caption>
        )}

        {error && (
          <Body role="alert" className="text-sm text-fg-muted">
            {error}
          </Body>
        )}
        {isUnlock ? (
          <>
            <TextField
              label={t("collection.lockPasswordLabel")}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitUnlock();
              }}
              error={error ?? undefined}
              autoComplete="current-password"
            />
            <Button
              className="w-full"
              disabled={busy || password.length === 0}
              onClick={() => void submitUnlock()}
            >
              {busy
                ? t("collection.lockVerifying")
                : t("collection.lockUnlock")}
            </Button>
          </>
        ) : (
          <>
            {locked && (
              <TextField
                label={t("collection.lockCurrentPasswordLabel")}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                error={error ?? undefined}
                autoComplete="current-password"
              />
            )}
            <TextField
              label={t("collection.lockNewPasswordLabel")}
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
              }}
              helperText={t("collection.lockNewPasswordHint")}
              autoComplete="new-password"
            />
            <Button
              className="w-full"
              variant="outline"
              disabled={
                busy ||
                newPassword.length < 4 ||
                (locked && password.length === 0)
              }
              onClick={() => void submitSet()}
            >
              {locked ? t("collection.lockChange") : t("collection.lockSet")}
            </Button>
            {locked && (
              <>
                <div className="border-t border-border pt-3">
                  <Button
                    className="mt-2 w-full"
                    variant="ghost"
                    disabled={busy || password.length === 0}
                    onClick={() => void submitClear()}
                  >
                    {t("collection.lockClear")}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
