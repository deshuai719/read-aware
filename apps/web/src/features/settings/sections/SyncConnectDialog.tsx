/**
 * Connect dialog for a personal self-hosted relay: server address +
 * username + password (one password doubles as the E2E key derivation
 * input). The account email returned by the relay is shown before the
 * connection commits — the identity gate — then the same password derives
 * the master key via establishEncryption.
 */
import { useEffect, useRef, useState } from "react";
import { Button, Caption, Dialog, Spinner, TextField, useToast } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import { createLogger } from "../../../platform/logger";
import {
  InvalidSignInResponseError,
  type SignInVerification,
} from "../../../platform/sync/connect";
import { RelayError } from "../../../platform/sync/relay-client";
import { relayBaseUrl, setRelayBaseUrl } from "../../../platform/sync/sync-scheduler";
import {
  SyncConnectionBusyError,
  WrongPassphraseError,
  type useSyncConnection,
} from "../hooks/useSyncConnection";

const log = createLogger("sync");

type SyncConnectDialogProps = {
  open: boolean;
  onClose: () => void;
  sync: ReturnType<typeof useSyncConnection>;
};

export function SyncConnectDialog({ open, onClose, sync }: SyncConnectDialogProps) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();

  type Step = "signIn" | "verifying" | "confirm";
  const [step, setStep] = useState<Step>("signIn");
  const [serverUrl, setServerUrl] = useState(() => relayBaseUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<SignInVerification | null>(null);
  const attempt = useRef(0);

  const reset = () => {
    setStep("signIn");
    setUsername("");
    setPassword("");
    setError(null);
    setVerification(null);
  };

  const handleClose = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  /** Phase 1: username + password → which account it opened. */
  const submitCredentials = async () => {
    const current = ++attempt.current;
    setError(null);
    setVerification(null);
    setPassword(password); // survives into phase 2 in this closure
    setStep("verifying");
    setRelayBaseUrl(serverUrl);
    try {
      const verified = await sync.loginWithPassword(username.trim(), password);
      if (current !== attempt.current) return;
      setVerification(verified);
      setStep("confirm");
    } catch (error) {
      if (current !== attempt.current) return;
      if (error instanceof SyncConnectionBusyError) {
        setStep("signIn");
        return;
      }
      log.error("password login failed", error);
      setStep("signIn");
      if (error instanceof InvalidSignInResponseError) {
        setError(t("dataSync.connect.invalidCredentials"));
        return;
      }
      const rejected =
        error instanceof RelayError && (error.status === 400 || error.status === 401);
      setError(
        t(rejected ? "dataSync.connect.invalidCredentials" : "dataSync.connect.failed"),
      );
    }
  };

  /** Phase 2: same password derives the master key; commit the connection. */
  const handleConnect = async () => {
    if (!verification) return;
    setError(null);
    try {
      await sync.finishConnect(verification, password);
      reset();
      onClose();
      toast({
        variant: "success",
        title: t("dataSync.noticeDone"),
        description: t("dataSync.connect.connected"),
      });
    } catch (error) {
      if (error instanceof SyncConnectionBusyError) return;
      if (error instanceof WrongPassphraseError) {
        setStep("signIn");
        setError(t("dataSync.connect.wrongPassphrase"));
        return;
      }
      log.error("connect failed", error);
      toast({
        variant: "destructive",
        title: t("dataSync.noticeError"),
        description: t("dataSync.connect.failed"),
      });
    }
  };

  // Never leave a password in mounted state after the surface closes.
  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("dataSync.connectAccount")}
      className="max-h-full overflow-y-auto"
    >
      {step === "signIn" ? (
        <div className="mt-4 space-y-4">
          <Caption className="text-fg-muted">{t("dataSync.account.description")}</Caption>
          <TextField
            label={t("dataSync.connect.serverUrlLabel")}
            type="url"
            placeholder={t("dataSync.connect.serverUrlPlaceholder")}
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            autoComplete="url"
          />
          <TextField
            label={t("dataSync.connect.usernameLabel")}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError(null);
            }}
            autoComplete="username"
          />
          <TextField
            label={t("dataSync.connect.passwordLabel")}
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            error={error ?? undefined}
            autoComplete="current-password"
          />
          <Button
            className="w-full"
            disabled={sync.busy || username.trim().length === 0 || password.length === 0}
            onClick={() => void submitCredentials()}
          >
            {sync.busy ? t("dataSync.connect.connecting") : t("dataSync.connect.passwordLogin")}
          </Button>
        </div>
      ) : step === "verifying" ? (
        <div className="mt-6 flex min-h-24 items-center justify-center gap-2 text-fg-muted">
          <Spinner size="sm" />
          <Caption>{t("dataSync.connect.verifying")}</Caption>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* The identity gate is its own user action; the connection commits
              only after this account is confirmed. */}
          <div className="rounded-md border border-border bg-paper-warm px-3 py-2.5">
            <Caption className="text-fg-muted">{t("dataSync.connect.signedInAs")}</Caption>
            <p className="mt-0.5 font-medium break-all">{verification?.email}</p>
          </div>
          {verification?.keys == null && (
            <p className="text-caption leading-relaxed text-fg-muted">
              {t("dataSync.connect.freshAccount")}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("signIn")}>
              {t("dataSync.connect.back")}
            </Button>
            <Button size="sm" disabled={sync.busy || !verification} onClick={() => void handleConnect()}>
              {sync.busy ? t("dataSync.connect.connecting") : t("dataSync.connect.passwordLogin")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}