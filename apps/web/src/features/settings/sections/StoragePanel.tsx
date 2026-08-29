/**
 * Settings 鈥?Storage: where the library (books, progress, plugins, sync
 * database) lives. The user can point ReadAware at a folder on any drive; the
 * move is staged here and executed by the Rust shell on the next start, so the
 * running app never relocates its own open database. The old folder is kept
 * intact 鈥?switching back is just "revert to default".
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, Spinner, useToast } from "@read-aware/ui";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { isMobileOS, isTauri } from "../../../platform/environment";
import {
  cancelPendingMigration,
  getDataDirInfo,
  prepareDataDir,
  revertDataDirToDefault,
  type DataDirInfo,
} from "../../../platform/data-dir";
import { createLogger } from "../../../platform/logger";
import { useTranslation } from "../../../i18n";
import { SettingsGroup } from "../components/SettingsGroup";
import { SettingsPage } from "../components/SettingsPage";
import { SettingsRow } from "../components/SettingsRow";
import {
  canCancelPending,
  canChangeDataDir,
  canRevertDataDir,
  DATA_DIR_SOURCE_KEYS,
} from "../lib/storage-settings";

const log = createLogger("storage");

export function StoragePanel() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [info, setInfo] = useState<DataDirInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setInfo(await getDataDirInfo());
    } catch (error) {
      log.error("loading data-dir info failed", error);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const failureToast = (error: unknown, what: "prepare" | "cancel" | "revert") => {
    log.error(`data-dir ${what} failed`, error);
    toast({
      variant: "destructive",
      title: t("storage.noticeError"),
      description: String(error),
    });
  };

  const handleChange = async () => {
    if (!isTauri()) return;
    setBusy(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      await prepareDataDir(selected);
      await reload();
      setRestartOpen(true);
    } catch (error) {
      failureToast(error, "prepare");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPending = async () => {
    setBusy(true);
    try {
      await cancelPendingMigration();
      await reload();
      toast({
        variant: "success",
        title: t("storage.noticeDone"),
        description: t("storage.canceled"),
      });
    } catch (error) {
      failureToast(error, "cancel");
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async () => {
    setRevertOpen(false);
    setBusy(true);
    try {
      await revertDataDirToDefault();
      await reload();
      setRestartOpen(true);
    } catch (error) {
      failureToast(error, "revert");
    } finally {
      setBusy(false);
    }
  };

  // The data root is desktop-only (mobile always uses the OS default); hide
  // every action behind the desktop gate so the panel degrades to read-only.
  const desktop = isTauri() && !isMobileOS();
  const changeable = desktop && canChangeDataDir(info);
  const revertable = desktop && canRevertDataDir(info);
  const cancelable = desktop && canCancelPending(info);

  return (
    <SettingsPage title={t("storage.title")} description={t("storage.description")}>
      <SettingsGroup title={t("storage.currentGroup")}>
        <SettingsRow
          borderless
          title={t("storage.currentDir")}
          description={info ? t("storage.sourceLabel", { source: t(`storage.source.${DATA_DIR_SOURCE_KEYS[info.source]}`) }) : undefined}
          control={
            info && desktop ? (
              <Button variant="outline" size="sm" onClick={() => void revealItemInDir(info.activeDir)}>
                {t("storage.openDir")}
              </Button>
            ) : undefined
          }
        />
        {info && (
          <SettingsRow
            title={t("storage.currentPath")}
            control={
              <span className="max-w-72 select-all truncate rounded-md border border-border bg-fill px-2 py-1 font-mono text-xs text-fg">
                {info.activeDir}
              </span>
            }
          />
        )}
        {info?.pending && (
          <SettingsRow
            title={t("storage.pendingTitle")}
            description={t("storage.pendingDescription", { path: info.pending.target })}
            control={
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !cancelable}
                onClick={() => void handleCancelPending()}
              >
                {busy && <Spinner size="sm" />}
                {t("storage.cancelPending")}
              </Button>
            }
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t("storage.moveGroup")}
        description={t("storage.moveGroupDescription")}
      >
        <SettingsRow
          borderless
          title={t("storage.change")}
          description={t("storage.changeDescription")}
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={!desktop || busy || !changeable}
              onClick={() => void handleChange()}
            >
              {busy && <Spinner size="sm" />}
              {t("storage.changeButton")}
            </Button>
          }
        />
        {revertable && (
          <SettingsRow
            title={t("storage.revert")}
            description={t("storage.revertDescription")}
            control={
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setRevertOpen(true)}
              >
                {t("storage.revertButton")}
              </Button>
            }
          />
        )}
      </SettingsGroup>

      <Dialog
        open={restartOpen}
        onClose={() => setRestartOpen(false)}
        title={t("storage.restartTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-fg-muted">{t("storage.restartBody")}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRestartOpen(false)}>
              {t("storage.later")}
            </Button>
            <Button size="sm" onClick={() => void relaunch()}>
              {t("storage.restartNow")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={revertOpen}
        onClose={() => setRevertOpen(false)}
        title={t("storage.revertConfirmTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-fg-muted">{t("storage.revertConfirmBody")}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRevertOpen(false)}>
              {t("storage.later")}
            </Button>
            <Button size="sm" onClick={() => void handleRevert()}>
              {t("storage.revertConfirmButton")}
            </Button>
          </div>
        </div>
      </Dialog>
    </SettingsPage>
  );
}