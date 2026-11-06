import { useCallback, useRef } from "react";
import type { ReadingPositionContext } from "@read-aware/core";
import { userDomain } from "../../../domain";
import type { FoliateRelocateDetail, FoliateView } from "../lib/foliate-engine";
import {
  capturePositionContext,
  restoreReaderPosition,
  type RecoverySource,
} from "../lib/position-recovery";
/** One source-bound recovery snapshot, shared by progress capture and engine rebuilds. */
export function useReaderPosition(
  bookId: string | null,
  textEncoding: string,
  context?: ReadingPositionContext,
) {
  const contextRef = useRef(context);
  contextRef.current = context;
  const identityRef = useRef<RecoverySource>({
    sourceSha256: null,
    textEncoding,
  });
  const loadSource = useCallback(async () => {
    const identity = bookId
      ? await userDomain.reading.queries.sourceIdentity(bookId)
      : { sourceSha256: null };
    return { ...identity, textEncoding };
  }, [bookId, textEncoding]);
  const capture = useCallback(
    (detail: FoliateRelocateDetail, source: RecoverySource, accept = true) => {
      const next = capturePositionContext(detail, source);
      if (accept) {
        identityRef.current = source;
        contextRef.current = next;
      }
      return next;
    },
    [],
  );
  const restore = useCallback(
    (
      view: FoliateView,
      target: string | null,
      fraction: number,
      source: RecoverySource,
      saved: ReadingPositionContext | undefined,
      cancelled: () => boolean,
    ) =>
      restoreReaderPosition({
        view,
        target,
        fraction,
        source,
        context: saved,
        cancelled,
      }),
    [],
  );
  return { contextRef, loadSource, capture, restore };
}
