import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentRuntime } from "../../ai/agent/agent-runtime";
import {
  translatePassage,
  normalizeTranslationLanguage,
  type TranslationLanguage,
} from "../lib/translation";
import { useTranslation } from "../../../i18n";
import { localKV } from "../../../platform/local-store";
const KEY = "read-aware-translation-language";
export function useReaderTranslation(bookId: string) {
  const { t } = useTranslation("reader"),
    [text, setText] = useState(""),
    [open, setOpen] = useState(false),
    [language, setLanguage] = useState<TranslationLanguage>(() =>
      normalizeTranslationLanguage(localKV.getItem(KEY)),
    ),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null),
    epoch = useRef(0);
  const cancel = useCallback(() => {
    epoch.current++;
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
  }, []);
  useEffect(() => () => cancel(), [bookId, cancel]);
  const translate = useCallback(
    async (passage = text, target = language) => {
      cancel();
      setResult("");
      setError(null);
      setText(passage);
      setOpen(true);
      setLanguage(target);
      localKV.setItem(KEY, target);
      const runtime = getAgentRuntime();
      if (!runtime) {
        setError(t("translation.configure"));
        return;
      }
      const token = epoch.current,
        controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      try {
        const full = await translatePassage(
          runtime,
          passage,
          target,
          controller.signal,
          (delta) => {
            if (token === epoch.current) setResult((old) => old + delta);
          },
        );
        if (token === epoch.current) setResult(full);
      } catch {
        if (token === epoch.current && !controller.signal.aborted)
          setError(t("translation.failed"));
      } finally {
        if (token === epoch.current) setBusy(false);
      }
    },
    [cancel, language, text, t],
  );
  return {
    text,
    open,
    language,
    result,
    busy,
    error,
    translate,
    cancel,
    close: () => {
      cancel();
      setOpen(false);
    },
    setLanguage: (value: TranslationLanguage) => {
      setLanguage(value);
      void translate(text, value);
    },
  };
}
