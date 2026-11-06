import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { onAppEvent } from "../../../platform/app-events";
import { isTauri } from "../../../platform/environment";
import { userDomain } from "../../../domain";
import {
  ensureLocalFontFaceCss,
  type LocalReadingFont,
} from "../lib/local-font-store";
import { useTranslation } from "../../../i18n";
export function useLocalFonts(
  value: string | null,
  onChange: (font: string) => void,
) {
  const { t } = useTranslation("settings"),
    [fonts, setFonts] = useState<LocalReadingFont[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    pending = useRef(false);
  const reload = useCallback(
    () => setFonts(userDomain.reading.queries.localFonts.list()),
    [],
  );
  useEffect(() => {
    reload();
    return onAppEvent("local-fonts-changed", reload);
  }, [reload]);
  const run = useCallback(
    async (work: () => Promise<void>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError(null);
      try {
        await work();
        reload();
      } catch {
        setError(t("font.importFailed"));
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [reload, t],
  );
  const importFont = () =>
    run(async () => {
      if (!isTauri()) throw new Error("font-desktop-only");
      const path = await open({
        multiple: false,
        filters: [
          { name: "Font", extensions: ["ttf", "otf", "woff", "woff2"] },
        ],
      });
      if (!path || Array.isArray(path)) return;
      const font = await userDomain.reading.commands.localFonts.import({
        path,
      });
      onChange("local:" + font.id);
    });
  const remove = () =>
    run(async () => {
      const id = value?.startsWith("local:") ? value.slice(6) : null;
      if (!id) return;
      await userDomain.reading.commands.localFonts.remove(id);
      onChange("curated:inter");
    });
  return {
    fonts,
    busy,
    error,
    importFont,
    remove,
    canRemove: fonts.some((font) => value === "local:" + font.id),
  };
}
export function useLocalFontFace(value: string) {
  const [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(
    () => onAppEvent("local-fonts-changed", () => setRevision((v) => v + 1)),
    [],
  );
  useEffect(() => {
    if (!value.startsWith("local:")) {
      setError(false);
      return;
    }
    let active = true;
    setError(false);
    void ensureLocalFontFaceCss(value)
      .then((css) => {
        if (!active) return;
        const id = "local-font-" + value.slice(6);
        let style = document.getElementById(id);
        if (!style) {
          style = document.createElement("style");
          style.id = id;
          document.head.append(style);
        }
        style.textContent = css;
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value, revision]);
  return { error, retry: () => setRevision((v) => v + 1) };
}
