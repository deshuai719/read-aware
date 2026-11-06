import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
export function useCollectionLockForm({
  open,
  collectionId,
  onClose,
  onUnlock,
  onSetPassword,
  onClearPassword,
}: {
  open: boolean;
  collectionId?: string;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean>;
  onSetPassword: (
    password: string,
    currentPassword: string,
  ) => Promise<boolean>;
  onClearPassword: (password: string) => Promise<boolean>;
}) {
  const { t } = useTranslation("shelf");
  const [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const token = useRef(0),
    pending = useRef(false);
  useEffect(() => {
    token.current++;
    pending.current = false;
    setPassword("");
    setNewPassword("");
    setError(null);
    setBusy(false);
  }, [open, collectionId]);
  const close = () => {
    if (!pending.current) onClose();
  };
  async function execute(work: () => Promise<boolean>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const epoch = token.current;
    try {
      const ok = await work();
      if (epoch !== token.current) return;
      if (ok) onClose();
      else setError(t("collection.lockWrongPassword"));
    } catch {
      if (epoch === token.current)
        setError(t("collection.lockOperationFailed"));
    } finally {
      if (epoch === token.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return {
    password,
    newPassword,
    error,
    busy,
    close,
    setPassword: (value: string) => {
      setPassword(value);
      setError(null);
    },
    setNewPassword: (value: string) => {
      setNewPassword(value);
      setError(null);
    },
    submitUnlock: () =>
      password ? execute(() => onUnlock(password)) : Promise.resolve(),
    submitSet: () =>
      newPassword.length >= 4
        ? execute(() => onSetPassword(newPassword, password))
        : Promise.resolve(),
    submitClear: () =>
      password ? execute(() => onClearPassword(password)) : Promise.resolve(),
  };
}
