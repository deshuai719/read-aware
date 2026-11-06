import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { FoliateView } from "../lib/foliate-engine";
import type { TocEntry } from "../lib/reader-types";
import { findTocIndexForHref } from "../lib/epub-utils";
import {
  subscribeToAppKeyDown,
  isEditableKeyTarget,
} from "../../../platform/app-keydown";
import { useTranslation } from "../../../i18n";
export function useReaderNavigation({
  viewRef,
  ready,
  enabled,
  entries,
  href,
  onChapterSelect,
}: {
  viewRef: RefObject<FoliateView | null>;
  ready: number;
  enabled: boolean;
  entries: TocEntry[];
  href: string | null;
  onChapterSelect: (href: string) => void;
}) {
  const { t } = useTranslation("reader"),
    [canBack, setCanBack] = useState(false),
    [canForward, setCanForward] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    pending = useRef(false);
  const current = useRef({ enabled });
  current.current = { enabled };
  useEffect(() => {
    const history = viewRef.current?.history;
    const sync = () => {
      setCanBack(history?.canGoBack ?? false);
      setCanForward(history?.canGoForward ?? false);
    };
    sync();
    setError(null);
    history?.addEventListener("index-change", sync);
    return () => history?.removeEventListener("index-change", sync);
  }, [viewRef, ready]);
  const step = useCallback(
    async (direction: -1 | 1) => {
      if (pending.current || !current.current.enabled) return;
      const view = viewRef.current;
      if (!view) return;
      pending.current = true;
      setBusy(true);
      setError(null);
      try {
        await (direction < 0 ? view.history.back() : view.history.forward());
      } catch {
        if (viewRef.current === view) setError(t("navigation.failed"));
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [viewRef, t],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !current.current.enabled ||
        isEditableKeyTarget(event.target) ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        void step(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    return subscribeToAppKeyDown(key);
  }, [step]);
  const index = findTocIndexForHref(entries, href),
    previous = index > 0 ? entries[index - 1] : null,
    next = index >= 0 && index < entries.length - 1 ? entries[index + 1] : null;
  return {
    canBack: enabled && canBack,
    canForward: enabled && canForward,
    busy,
    error,
    step,
    previous,
    next,
    chapter: (direction: -1 | 1) => {
      const entry = direction < 0 ? previous : next;
      if (enabled && entry) onChapterSelect(entry.href);
    },
  };
}
export type ReaderNavigationApi = ReturnType<typeof useReaderNavigation>;
