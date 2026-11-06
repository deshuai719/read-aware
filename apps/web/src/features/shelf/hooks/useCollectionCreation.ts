import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import type { Collection } from "../../library/lib/library-types";
export function useCollectionCreation({
  open,
  onCreate,
  onCreated,
}: {
  open: boolean;
  onCreate: (name: string, password?: string) => Promise<Collection | null>;
  onCreated: (collection: Collection) => void | Promise<void>;
}) {
  const { t } = useTranslation("shelf"),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    pending.current = false;
    setName("");
    setPassword("");
    setError(null);
    setBusy(false);
  }, [open]);
  async function create() {
    if (pending.current || !name.trim()) return;
    if (password && password.length < 4) {
      setError(t("collection.lockNewPasswordHint"));
      return;
    }
    const token = epoch.current;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const collection = await onCreate(name.trim(), password || undefined);
      if (token !== epoch.current) return;
      if (!collection) {
        setError(t("collectionDialog.createFailed"));
        return;
      }
      await onCreated(collection);
    } catch {
      if (token === epoch.current) setError(t("collectionDialog.createFailed"));
    } finally {
      if (token === epoch.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return { name, password, error, busy, create, setName, setPassword };
}
