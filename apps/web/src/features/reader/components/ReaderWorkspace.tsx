import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { Body, Button, Spinner } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import type {
  BookFormat,
  LibraryBook,
  ReaderProgress,
} from "../../library/lib/library-types";
import type { ReaderLoadError } from "../hooks/useReaderSession";
import { useReaderNavigation } from "../hooks/useReaderNavigation";
import {
  useReaderSearch,
  type ReaderSearchApi,
} from "../hooks/useReaderSearch";
import { useReaderFindNavigation } from "../hooks/useReaderFindNavigation";
import { useReaderPalette } from "../../settings/hooks/useReaderPalette";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import { readTextUnitModeState } from "../lib/text-unit-mode-state";
import { useImmersiveWindowControls } from "../hooks/useImmersiveWindowControls";
import { useReaderAppearance } from "../hooks/useReaderAppearance";
import { useReadingTimeTracker } from "../hooks/useReadingTimeTracker";
import { FoliateReaderView } from "./FoliateReaderView";
import { ReaderShellOverlay } from "./ReaderShellOverlay";
import type { LoadedBook, ReadingCursor, TocEntry } from "../lib/reader-types";
import type { FoliateBook, FoliateView } from "../lib/foliate-engine";
import { textUnitReaderModeAtom } from "../../plugins/state/plugin-store";

type ReaderWorkspaceProps = {
  selectedBook: LibraryBook;
  readerSource: { format: BookFormat; data: LoadedBook } | null;
  readerLoadError: ReaderLoadError | null;
  isReaderLoading: boolean;
  readerToc: TocEntry[];
  currentChapterHref: string | null;
  chapterNavigationRequest: {
    href: string;
    requestId: number;
  } | null;
  annotationNavigationRequest: {
    cfiRange: string;
    requestId: number;
  } | null;
  searchNavigationRequest: {
    cfi: string;
    requestId: number;
  } | null;
  fractionNavigationRequest: {
    fraction: number;
    requestId: number;
  } | null;
  overlayVisible: boolean;
  selectedEpubProgress: ReaderProgress | null;
  readerProgress: number | undefined;
  currentPage: number;
  totalPages: number;
  onCloseReader: () => void;
  onRetryOpen: (book: LibraryBook) => void;
  /** Open the import picker — re-importing the same file heals a book whose
   *  bytes never reached this device (sha-keyed dedup binds them back). */
  onReimportBook: () => void;
  onToggleShell: () => void;
  onHideShell: () => void;
  onReaderPageChange: (current: number, total: number) => void;
  onEpubProgressChange: (
    progress: ReaderProgress,
    sourceBookId?: string,
  ) => void;
  onReaderFractionChange: (fraction: number) => void;
  onSeek: (fraction: number) => void;
  onTocChange: (entries: TocEntry[]) => void;
  onCurrentChapterChange: (href: string | null) => void;
  onBookReady: (book: LibraryBook, foliateBook: FoliateBook) => void;
  onChapterSelect: (href: string) => void;
  onAnnotationSelect: (cfiRange: string) => void;
  onSearchResultSelect: (cfi: string) => void;
  /** Pause/resume persisting reading progress (search jumps must not rewrite it). */
  onProgressSuspendedChange?: (suspended: boolean) => void;
};

export function ReaderWorkspace({
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
  currentPage,
  totalPages,
  onCloseReader,
  onRetryOpen,
  onReimportBook,
  onToggleShell,
  onHideShell,
  onReaderPageChange,
  onEpubProgressChange,
  onReaderFractionChange,
  onSeek,
  onTocChange,
  onCurrentChapterChange,
  onBookReady,
  onChapterSelect,
  onAnnotationSelect,
  onSearchResultSelect,
  onProgressSuspendedChange,
}: ReaderWorkspaceProps) {
  const { t } = useTranslation("reader");
  const { effective: readerSettings, textEncoding } = useReaderAppearance(
    selectedBook.id,
  );
  const [decoding, setDecoding] = useState<FoliateBook["decoding"]>();
  const themeBg = useReaderPalette(readerSettings.theme).bg;
  // Only surface the source loader once opening is genuinely slow, so fast opens
  // show nothing (themed background) instead of a flashed line of text.
  const showSourceLoader = useDelayedFlag(
    !readerSource && !readerLoadError,
    250,
  );

  // The engine element lives here, one level above the view that creates it:
  // the shell's search panel drives the search lifecycle through the same ref.
  const viewRef = useRef<FoliateView | null>(null);
  const search = useReaderSearch({ viewRef, bookId: selectedBook.id });

  // Search navigation. A jump is not reading: the origin is captured on the
  // first jump and progress persistence is paused until the reader either
  // returns or closes the panel, so a search never overwrites the place the
  // reader actually was.
  const searchOriginFractionRef = useRef<number | null>(null);
  const originAnchorRef = useRef<string | null>(null);
  const lastAnchorRef = useRef<string | null>(null);
  const returningRef = useRef<string | number | null>(null);
  const lastFractionRef = useRef<number | null>(null);
  const [searchCanReturn, setSearchCanReturn] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(0);
  const navigationTools = useReaderNavigation({
    viewRef,
    ready: engineReady,
    enabled: Boolean(readerSource) && !isReaderLoading && !findOpen,
    entries: readerToc,
    href: currentChapterHref,
    onChapterSelect,
  });

  const handleFractionChange = useCallback(
    (fraction: number) => {
      lastFractionRef.current = fraction;
      onReaderFractionChange(fraction);
    },
    [onReaderFractionChange],
  );

  const jumpToSearchResult = useCallback(
    (cfi: string) => {
      if (
        searchOriginFractionRef.current === null &&
        lastFractionRef.current !== null
      ) {
        searchOriginFractionRef.current = lastFractionRef.current;
        originAnchorRef.current = lastAnchorRef.current;
        setSearchCanReturn(true);
      }
      onProgressSuspendedChange?.(true);
      void viewRef.current?.setSearchActive?.(cfi);
      onSearchResultSelect(cfi);
    },
    [onProgressSuspendedChange, onSearchResultSelect],
  );

  const returnToSearchOrigin = useCallback(() => {
    const origin = searchOriginFractionRef.current;
    if (origin == null) return;
    onProgressSuspendedChange?.(true);
    const anchor = originAnchorRef.current;
    returningRef.current = anchor ?? origin;
    if (anchor) onSearchResultSelect(anchor);
    else onSeek(origin);
  }, [onProgressSuspendedChange, onSearchResultSelect, onSeek]);

  const navigation = useReaderFindNavigation(search, jumpToSearchResult);
  const handleFindOpenChange = useCallback(
    (open: boolean) => {
      setFindOpen(open);
      if (open) onHideShell();
    },
    [onHideShell],
  );
  const handleFindStep = useCallback(
    (direction: -1 | 1) => {
      setFindOpen(true);
      onHideShell();
      navigation.step(direction);
    },
    [onHideShell, navigation.step],
  );
  const searchApi = useMemo<ReaderSearchApi>(
    () => ({
      ...search,
      ...navigation,
      canReturn: searchCanReturn,
      returnToPosition: returnToSearchOrigin,
    }),
    [search, navigation, searchCanReturn, returnToSearchOrigin],
  );
  // Closing accepts the current landing, removes marks, and ends THIS return origin.
  // A later find starts from the later reading position rather than stale history.
  const handleSearchClosed = useCallback(() => {
    search.dismiss();
    if (returningRef.current !== null) return;
    searchOriginFractionRef.current = null;
    originAnchorRef.current = null;
    setSearchCanReturn(false);
    const accepted = lastAnchorRef.current;
    if (accepted) viewRef.current?.history.replaceState(accepted);
    onProgressSuspendedChange?.(false);
  }, [onProgressSuspendedChange, search.dismiss]);

  const handleNavigationSettled = useCallback(
    (target: string | number, error: string | null) => {
      if (returningRef.current !== null && target === returningRef.current) {
        if (
          error &&
          typeof target === "string" &&
          searchOriginFractionRef.current !== null
        ) {
          returningRef.current = searchOriginFractionRef.current;
          onSeek(searchOriginFractionRef.current);
          return;
        }
        returningRef.current = null;
        searchOriginFractionRef.current = null;
        originAnchorRef.current = null;
        setSearchCanReturn(false);
        onProgressSuspendedChange?.(false);
      } else if (error) onProgressSuspendedChange?.(false);
    },
    [onProgressSuspendedChange, onSeek],
  );
  useEffect(() => {
    searchOriginFractionRef.current = null;
    originAnchorRef.current = null;
    lastAnchorRef.current = null;
    lastFractionRef.current = null;
    returningRef.current = null;
    setSearchCanReturn(false);
  }, [selectedBook.id]);

  useEffect(() => {
    search.clear();
    setFindOpen(false);
    setSearchCanReturn(false);
    searchOriginFractionRef.current = null;
    originAnchorRef.current = null;
    returningRef.current = null;
    setDecoding(undefined);
  }, [textEncoding, search.clear]);
  const headerVisible = !isReaderLoading && overlayVisible;
  // Hide the native traffic lights only during true immersive reading (book
  // rendered, header dismissed). While the book is still loading or errored
  // there's no immersive view yet, so keep the window controls reachable.
  useImmersiveWindowControls(overlayVisible || !readerSource);

  // The official plugin supplies unit segmentation; the host still owns
  // the engine bridge and every control. State lives here so the shell header
  // and reader view (wash + floating bar + shortcuts) stay in sync. The mode is
  // sticky per book — closing a book (or the app) mid-navigation and reopening
  // it resumes unit-by-unit reading where it stopped (the resting
  // unit itself is restored by useTextUnitNavigator from the same store).
  // Fixed-layout books (PDF/CBZ) can't host it.
  const textUnitMode = useAtomValue(textUnitReaderModeAtom);
  const [textUnitModeActive, setTextUnitModeActive] = useState(
    () => readTextUnitModeState(selectedBook.id).active,
  );
  const [isFixedLayout, setIsFixedLayout] = useState(false);
  const [readingCursor, setReadingCursor] = useState<ReadingCursor | null>(
    null,
  );
  useEffect(() => {
    setTextUnitModeActive(readTextUnitModeState(selectedBook.id).active);
  }, [selectedBook.id]);
  useEffect(() => {
    setReadingCursor(null);
  }, [selectedBook.id, readerSource]);
  const toggleTextUnitMode = useCallback(() => {
    setTextUnitModeActive((active) => !active);
    // Entering the mode is a "start reading" gesture — drop the chrome so the
    // wash and the floating bar take over immediately.
    if (!textUnitModeActive) onHideShell();
  }, [textUnitModeActive, onHideShell]);
  const exitTextUnitMode = useCallback(() => setTextUnitModeActive(false), []);

  // Track active reading time once the book is rendered. Reader relocate/page
  // callbacks bump activity so in-iframe reading isn't mistaken for idle.
  const { recordActivity } = useReadingTimeTracker(
    selectedBook.id,
    !!readerSource,
  );
  const handlePageChange = useCallback(
    (current: number, total: number) => {
      recordActivity();
      onReaderPageChange(current, total);
    },
    [recordActivity, onReaderPageChange],
  );
  const handleProgressChange = useCallback(
    (progress: ReaderProgress, sourceBookId?: string) => {
      recordActivity();
      onEpubProgressChange(progress, sourceBookId);
    },
    [recordActivity, onEpubProgressChange],
  );

  return (
    <div
      // Deliberately no entrance fade: the shelf dissolves ON TOP of this
      // surface when a book opens (see App.tsx), and a cross-fade only reads
      // cleanly when the incoming layer is already opaque — two simultaneous
      // fades let the body background flash through.
      className="relative h-screen w-full"
      style={{ backgroundColor: themeBg }}
    >
      {readerSource ? (
        <FoliateReaderView
          selectedBook={selectedBook}
          initialBook={readerSource.data}
          readerSettings={readerSettings}
          textEncoding={textEncoding}
          viewRef={viewRef}
          shellVisible={overlayVisible}
          onCloseReader={onCloseReader}
          onContentClick={onToggleShell}
          onContentScroll={onHideShell}
          onReadingActivity={recordActivity}
          onPageChange={handlePageChange}
          onProgressChange={handleProgressChange}
          onFractionChange={handleFractionChange}
          onTocChange={onTocChange}
          onCurrentChapterChange={onCurrentChapterChange}
          onReadingCursorChange={(cursor) => {
            lastAnchorRef.current = cursor.anchor ?? null;
            setReadingCursor(cursor);
          }}
          onNavigationSettled={handleNavigationSettled}
          findOpen={findOpen}
          onFindStep={handleFindStep}
          onBookReady={(foliateBook) => {
            onBookReady(selectedBook, foliateBook);
            search.notifyReady();
            setDecoding(foliateBook.decoding);
            setEngineReady((n) => n + 1);
          }}
          onFixedLayoutChange={setIsFixedLayout}
          textUnitModeActive={textUnitModeActive}
          textUnitMode={textUnitMode}
          onExitTextUnitMode={exitTextUnitMode}
          onTextUnitModeStep={onHideShell}
          initialProgress={selectedEpubProgress}
          chapterNavigationRequest={chapterNavigationRequest}
          annotationNavigationRequest={annotationNavigationRequest}
          searchNavigationRequest={searchNavigationRequest}
          fractionNavigationRequest={fractionNavigationRequest}
        />
      ) : null}

      {!readerSource && (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          {readerLoadError ? (
            <div className="max-w-md space-y-4">
              <Body className="text-sm text-fg-muted">
                {readerLoadError.kind === "generic"
                  ? readerLoadError.message
                  : t(`fileMissing.${readerLoadError.reason}`)}
              </Body>
              <div className="flex items-center justify-center gap-2">
                {/* Retry leads only where retrying can succeed (a transient
                    fetch failure); a file the cloud never had needs the
                    original file back instead — re-importing it heals this
                    book in place through the sha dedup gate. */}
                {readerLoadError.kind === "file-missing" &&
                (readerLoadError.reason === "no-sync" ||
                  readerLoadError.reason === "not-on-relay") ? (
                  <Button size="sm" variant="outline" onClick={onReimportBook}>
                    {t("fileMissing.reimport")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetryOpen(selectedBook)}
                  >
                    {t("tryAgain")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onCloseReader}>
                  {t("backToLibrary")}
                </Button>
              </div>
            </div>
          ) : (
            showSourceLoader && (
              <Spinner
                size="md"
                label={t("opening", { name: selectedBook.title })}
              />
            )
          )}
        </div>
      )}

      <ReaderShellOverlay
        visible={headerVisible}
        onBack={onCloseReader}
        book={selectedBook}
        progress={readerProgress}
        currentPage={currentPage}
        totalPages={totalPages}
        tocEntries={readerToc}
        currentChapterHref={currentChapterHref}
        readingCursor={
          readingCursor ?? {
            ...(selectedEpubProgress?.cfi
              ? { anchor: selectedEpubProgress.cfi }
              : {}),
            ...(currentChapterHref ? { chapter: currentChapterHref } : {}),
            ...(readerProgress !== undefined
              ? { bookProgress: readerProgress }
              : {}),
            ...(totalPages > 0
              ? { location: { current: currentPage, total: totalPages } }
              : {}),
          }
        }
        onChapterSelect={onChapterSelect}
        onAnnotationSelect={onAnnotationSelect}
        search={searchApi}
        onSearchClosed={handleSearchClosed}
        findOpen={findOpen}
        onFindOpenChange={handleFindOpenChange}
        onSeek={onSeek}
        textUnitMode={textUnitMode}
        textUnitModeActive={textUnitModeActive}
        onToggleTextUnitMode={toggleTextUnitMode}
        fixedLayout={isFixedLayout}
        decoding={decoding}
        navigation={navigationTools}
        bookmarkEnabled={Boolean(readerSource) && !isReaderLoading && !findOpen}
      />
    </div>
  );
}
