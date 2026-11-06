import { createSearchProgressPreview } from "../lib/search-progress-preview";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "../../../i18n";
import { useLocalAtom } from "@read-aware/ui/state";
import { askAiRequestAtom } from "../../ai/state/chat-intent";
import {
  readerPanelIntentAtom,
  panelRevealsReaderChrome,
} from "../state/panel-intent";
import {
  markLibraryBookOpened,
  resolveStoredBookFile,
  updateLibraryBookProgress,
  type BookFileMissingReason,
} from "../../library/lib/library-db";
import { formatLibraryError } from "../../library/lib/format-library-error";
import { createProgressPatch } from "../../library/lib/library-progress";
import type {
  BookFormat,
  BookProgress,
  LibraryBook,
  ReaderProgress,
} from "../../library/lib/library-types";
import type { LoadedBook, TocEntry } from "../lib/reader-types";
import { createProgressThrottle } from "../lib/progress-throttle";
import { getVirtualBookBinding } from "../../plugins/lib/virtual-books";

type ReaderSource = { format: BookFormat; data: LoadedBook } | null;

/**
 * Why the reader couldn't open. `file-missing` keeps the CAUSE, because the
 * error screen owes each one different words and a different action — "retry"
 * heals an unreachable relay but never a file the cloud simply doesn't have,
 * where re-importing the original file is the honest way out (a re-import of
 * the same bytes heals the existing record in place via the sha dedup gate).
 */
export type ReaderLoadError =
  | { kind: "generic"; message: string }
  | { kind: "file-missing"; reason: BookFileMissingReason };

type UseReaderSessionOptions = {
  applyOptimisticProgress: (bookId: string, progress: BookProgress) => void;
  replaceBookInState: (
    book: LibraryBook,
    acknowledgedProgress?: BookProgress,
  ) => void;
  reportError: (error: unknown) => void;
};

export function useReaderSession({
  applyOptimisticProgress,
  replaceBookInState,
  reportError,
}: UseReaderSessionOptions) {
  // For localizing load-failure fallbacks (formatLibraryError's generic line).
  const { t } = useTranslation("shelf");
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [readerSource, setReaderSource] = useState<ReaderSource>(null);
  const [readerLoadError, setReaderLoadError] =
    useState<ReaderLoadError | null>(null);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [shellVisible, setShellVisible] = useLocalAtom(false);
  const [readerPage, setReaderPage] = useLocalAtom({ current: 0, total: 0 });
  const [readerToc, setReaderToc] = useLocalAtom<TocEntry[]>([]);
  const [currentChapterHref, setCurrentChapterHref] = useLocalAtom<
    string | null
  >(null);
  const [chapterNavigationRequest, setChapterNavigationRequest] = useLocalAtom<{
    href: string;
    requestId: number;
  } | null>(null);
  const [annotationNavigationRequest, setAnnotationNavigationRequest] =
    useLocalAtom<{
      cfiRange: string;
      requestId: number;
    } | null>(null);
  const [searchNavigationRequest, setSearchNavigationRequest] = useLocalAtom<{
    cfi: string;
    requestId: number;
  } | null>(null);
  const [fractionNavigationRequest, setFractionNavigationRequest] =
    useLocalAtom<{
      fraction: number;
      requestId: number;
    } | null>(null);
  // The engine's exact reading fraction. The persisted progress only carries a
  // rounded percentage, which is too coarse to paint (or seek from) the
  // header's progress bar.
  const [readerFraction, setReaderFraction] = useLocalAtom<number | null>(null);
  const readerLoadRequestIdRef = useRef(0);
  const currentBookIdRef = useRef<string | null>(null);
  const progressWritePausedRef = useRef(false);
  const latestAcceptedProgressRef = useRef(new Map<string, BookProgress>());
  const closeRequestRef = useRef<Promise<void> | null>(null);
  // Commit-side throttle for book.progressed: chapter changes commit promptly,
  // intra-chapter page turns coalesce (see progress-throttle.ts). Created once;
  // the commit callback reads the latest handlers through a ref so the
  // throttle's per-book pacing state survives re-renders.
  const latestProgressHandlersRef = useRef({ replaceBookInState, reportError });
  latestProgressHandlersRef.current = { replaceBookInState, reportError };
  const progressThrottleRef = useRef(
    createProgressThrottle((bookId, progress) => {
      const { replaceBookInState: replaceBook, reportError: report } =
        latestProgressHandlersRef.current;
      return updateLibraryBookProgress(bookId, progress)
        .then((nextBook) => {
          if (
            !nextBook ||
            latestAcceptedProgressRef.current.get(bookId) !== progress
          )
            return;
          setSelectedBook((currentBook) =>
            currentBook?.id === nextBook.id ? nextBook : currentBook,
          );
          replaceBook(nextBook, progress);
        })
        .catch((error) => {
          report(error);
          throw error;
        });
    }),
  );

  // "Ask AI about this" should reveal the reader shell even when the chrome is
  // dismissed (immersive reading), so the chat panel it opens is actually shown.
  const askAiRequest = useAtomValue(askAiRequestAtom);
  const handledAskAiIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!askAiRequest || askAiRequest.bookId !== selectedBook?.id) return;
    if (askAiRequest.id === handledAskAiIdRef.current) return;
    handledAskAiIdRef.current = askAiRequest.id;
    setShellVisible(true);
  }, [askAiRequest, selectedBook?.id, setShellVisible]);

  // 导航条的面板直达按钮同理：面板渲染在 chrome 里，意图到达即点亮 chrome
  // （目标面板由 ReaderShellOverlay 消费同一意图打开）。
  const panelIntent = useAtomValue(readerPanelIntentAtom);
  const handledPanelIntentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!panelIntent || panelIntent.bookId !== selectedBook?.id) return;
    if (panelIntent.id === handledPanelIntentIdRef.current) return;
    handledPanelIntentIdRef.current = panelIntent.id;
    if (panelRevealsReaderChrome(panelIntent.panel)) setShellVisible(true);
  }, [panelIntent, selectedBook?.id, setShellVisible]);

  useEffect(() => {
    const throttle = progressThrottleRef.current;
    return () => {
      // Flush, don't drop: a pending position on unmount is the user's last
      // reading position — losing it means reopening the book somewhere else.
      throttle.dispose();
    };
  }, []);

  const resetReaderState = useCallback(() => {
    setReaderSource(null);
    setReaderLoadError(null);
    setIsReaderLoading(false);
    setReaderPage({ current: 0, total: 0 });
    setReaderToc([]);
    setCurrentChapterHref(null);
    setChapterNavigationRequest(null);
    setAnnotationNavigationRequest(null);
    setSearchNavigationRequest(null);
    setFractionNavigationRequest(null);
    setReaderFraction(null);
  }, [
    setAnnotationNavigationRequest,
    setChapterNavigationRequest,
    setCurrentChapterHref,
    setFractionNavigationRequest,
    setReaderFraction,
    setReaderPage,
    setReaderToc,
    setSearchNavigationRequest,
  ]);

  // In-book search jumps around the book without reading it. Persisting those
  // positions would overwrite where the reader actually was — the complaint
  // that searching loses your place is exactly this write. Suspending the
  // queue keeps the on-screen position live while the stored one stays put.
  const progressPreviewRef = useRef(
    createSearchProgressPreview<BookProgress>(),
  );
  const queueProgressSave = useCallback(
    (bookId: string, progress: BookProgress) => {
      latestProgressHandlersRef.current = { replaceBookInState, reportError };
      latestAcceptedProgressRef.current.set(bookId, progress);
      progressThrottleRef.current.queue(bookId, progress);
    },
    [replaceBookInState, reportError],
  );
  const applyReaderProgress = useCallback(
    (bookId: string, progress: BookProgress) => {
      // Preview must not update the library book object either; only live reader UI moves.
      if (progressPreviewRef.current.capture(bookId, progress)) return;
      applyOptimisticProgress(bookId, progress);
      setSelectedBook((current) =>
        current?.id === bookId
          ? createProgressPatch(current, progress)
          : current,
      );
      queueProgressSave(bookId, progress);
    },
    [applyOptimisticProgress, queueProgressSave],
  );
  const setProgressSuspended = useCallback(
    (suspended: boolean) => {
      if (progressWritePausedRef.current) return;
      if (suspended) {
        progressThrottleRef.current.flushAll(); // persist the origin BEFORE leaving it
        progressPreviewRef.current.begin();
      } else {
        const latest = progressPreviewRef.current.finish();
        if (latest) applyReaderProgress(latest.bookId, latest.progress);
        progressThrottleRef.current.flushAll();
      }
    },
    [applyReaderProgress],
  );

  const drainProgress = useCallback(async () => {
    // Freeze callbacks during shutdown so a late relocation cannot enter the drain.
    // Do not accept an open find preview; leave its origin intact on a failed save.
    progressWritePausedRef.current = true;
    try {
      await progressThrottleRef.current.drain();
    } catch (error) {
      progressWritePausedRef.current = false;
      throw error;
    }
  }, []);
  const openReader = useCallback(
    (book: LibraryBook, options?: { anchor?: string }) => {
      const requestId = ++readerLoadRequestIdRef.current;
      void (async () => {
        try {
          await drainProgress();
          if (readerLoadRequestIdRef.current !== requestId) return;
          currentBookIdRef.current = book.id;
          progressWritePausedRef.current = false;
          closeRequestRef.current = null;
          progressPreviewRef.current.reset();
          const saved = latestAcceptedProgressRef.current.get(book.id);
          const initial =
            saved !== undefined ? createProgressPatch(book, saved) : book;
          setSelectedBook(initial);
          setShellVisible(false);
          resetReaderState();
          setIsReaderLoading(true);
          if (book.format === "virtual") {
            const binding = getVirtualBookBinding(book.id);
            if (!binding)
              throw new Error(
                "This book's plugin content source is not available.",
              );
            if (readerLoadRequestIdRef.current !== requestId) return;
            setReaderSource({
              format: book.format,
              data: {
                openingAnchor: options?.anchor,
                fileName: book.title,
                format: book.format,
                virtual: binding,
              },
            });
          } else {
            const resolved = await resolveStoredBookFile(initial);
            if (readerLoadRequestIdRef.current !== requestId) return;
            if (resolved.status === "missing") {
              setReaderLoadError({
                kind: "file-missing",
                reason: resolved.reason,
              });
              setIsReaderLoading(false);
              return;
            }
            setReaderSource({
              format: book.format,
              data: {
                openingAnchor: options?.anchor,
                fileName: book.fileName,
                format: book.format,
                file: resolved.file,
              },
            });
          }
          setIsReaderLoading(false);
          const opened = await markLibraryBookOpened(book.id);
          if (
            opened &&
            readerLoadRequestIdRef.current === requestId &&
            currentBookIdRef.current === book.id
          ) {
            const latest = latestAcceptedProgressRef.current.get(book.id);
            const fresh =
              latest !== undefined
                ? createProgressPatch(opened, latest)
                : opened;
            setSelectedBook((current) =>
              current?.id === fresh.id ? fresh : current,
            );
            replaceBookInState(fresh);
          }
        } catch (error) {
          if (readerLoadRequestIdRef.current !== requestId) return;
          setReaderLoadError({
            kind: "generic",
            message: formatLibraryError(error, t),
          });
          setIsReaderLoading(false);
          reportError(error);
        }
      })();
    },
    [
      drainProgress,
      replaceBookInState,
      reportError,
      resetReaderState,
      setShellVisible,
      t,
    ],
  );
  const closeReader = useCallback(() => {
    if (closeRequestRef.current) return closeRequestRef.current;
    const id = currentBookIdRef.current,
      request = readerLoadRequestIdRef.current;
    const pending = drainProgress().then(() => {
      if (
        request !== readerLoadRequestIdRef.current ||
        currentBookIdRef.current !== id
      )
        return;
      readerLoadRequestIdRef.current++;
      currentBookIdRef.current = null;
      progressPreviewRef.current.reset();
      setSelectedBook(null);
      setShellVisible(false);
      resetReaderState();
    });
    closeRequestRef.current = pending;
    void pending
      .finally(() => {
        if (closeRequestRef.current === pending) closeRequestRef.current = null;
      })
      .catch(() => {});
    return pending;
  }, [drainProgress, resetReaderState, setShellVisible]);

  const toggleShell = useCallback(() => {
    setShellVisible((visible) => !visible);
  }, [setShellVisible]);

  const hideShell = useCallback(() => {
    setShellVisible(false);
  }, [setShellVisible]);

  const handleReaderPageChange = useCallback(
    (current: number, total: number) => {
      setReaderPage({ current, total });
    },
    [setReaderPage],
  );

  const handleEpubProgressChange = useCallback(
    (progress: ReaderProgress, sourceBookId?: string) => {
      const id = sourceBookId ?? selectedBook?.id;
      if (
        !id ||
        currentBookIdRef.current !== id ||
        progressWritePausedRef.current
      )
        return;
      setReaderPage({
        current: progress.currentLocation,
        total: progress.totalLocations,
      });

      applyReaderProgress(id, progress);
    },
    [applyReaderProgress, selectedBook, setReaderPage],
  );

  const handleReaderFractionChange = useCallback(
    (fraction: number) => {
      setReaderFraction(fraction);
    },
    [setReaderFraction],
  );

  // Scrubbing the header's progress bar. The shell deliberately stays open —
  // the user is working the header, and may well scrub again.
  const handleSeek = useCallback(
    (fraction: number) => {
      setFractionNavigationRequest((previous) => ({
        fraction,
        requestId: (previous?.requestId ?? 0) + 1,
      }));
    },
    [setFractionNavigationRequest],
  );

  const handleChapterSelect = useCallback(
    (href: string) => {
      setChapterNavigationRequest((previous) => ({
        href,
        requestId: (previous?.requestId ?? 0) + 1,
      }));
      setShellVisible(false);
    },
    [setChapterNavigationRequest, setShellVisible],
  );

  const handleAnnotationSelect = useCallback(
    (cfiRange: string) => {
      setAnnotationNavigationRequest((previous) => ({
        cfiRange,
        requestId: (previous?.requestId ?? 0) + 1,
      }));
      setShellVisible(false);
    },
    [setAnnotationNavigationRequest, setShellVisible],
  );

  // Jumping to a search hit works exactly like the annotation/notes jump —
  // same request+requestId channel, consumed by the reader view via `select`.
  const handleSearchResultSelect = useCallback(
    (cfi: string) => {
      setSearchNavigationRequest((previous) => ({
        cfi,
        requestId: (previous?.requestId ?? 0) + 1,
      }));
    },
    [setSearchNavigationRequest],
  );

  const overlayVisible = shellVisible;
  const selectedEpubProgress = selectedBook?.progress ?? null;
  // The engine's fraction once it has relocated; before that, the position the
  // book was left at (so the bar opens where reading stopped).
  const readerProgress =
    readerFraction ??
    (selectedBook?.progressPercent
      ? selectedBook.progressPercent / 100
      : undefined);

  return {
    selectedBook,
    readerSource,
    readerLoadError,
    isReaderLoading,
    readerToc,
    currentChapterHref,
    chapterNavigationRequest,
    annotationNavigationRequest,
    searchNavigationRequest,
    fractionNavigationRequest,
    overlayVisible,
    selectedEpubProgress,
    readerProgress,
    currentPage: readerPage.current,
    totalPages: readerPage.total,
    openReader,
    closeReader,
    drainProgress,
    toggleShell,
    hideShell,
    handleReaderPageChange,
    handleEpubProgressChange,
    handleReaderFractionChange,
    handleSeek,
    handleChapterSelect,
    handleAnnotationSelect,
    handleSearchResultSelect,
    setReaderToc,
    setCurrentChapterHref,
    setProgressSuspended,
  };
}
