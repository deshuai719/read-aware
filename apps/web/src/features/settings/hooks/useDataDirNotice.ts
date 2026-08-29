/**
 * One-shot boot notice for a staged data-directory move: after the restart
 * that performs the migration, the Rust shell records the outcome in
 * `data-dir.json` (`lastResult`). This hook turns it into a toast and consumes
 * it, so it cannot reappear on later launches.
 */
import { useEffect, useRef } from "react";
import { useToast } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import { clearDataDirNotice, getDataDirInfo } from "../../../platform/data-dir";
import { isTauri } from "../../../platform/environment";
import { createLogger } from "../../../platform/logger";

const log = createLogger("data-dir-notice");

export function useDataDirNotice() {
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const shownRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || shownRef.current) return;
    shownRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const info = await getDataDirInfo();
        const result = info?.lastResult;
        if (!result || cancelled) return;
        toast({
          variant: result.ok ? "success" : "destructive",
          title: result.ok
            ? t("storage.migrationDone")
            : t("storage.noticeError"),
          description: result.ok
            ? undefined
            : t("storage.migrationFailed", { message: result.message }),
        });
        await clearDataDirNotice();
      } catch (error) {
        log.error("reading data-dir notice failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, t]);
}