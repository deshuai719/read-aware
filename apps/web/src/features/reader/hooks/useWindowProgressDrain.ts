import { useEffect, useRef } from "react";
import { isMobileOS, isTauri } from "../../../platform/environment";
/** OS close, Alt+F4 and custom caption close share the same awaited progress drain. */
export function useWindowProgressDrain(
  drain: () => Promise<void>,
  report: (error: unknown) => void,
) {
  const handlers = useRef({ drain, report });
  handlers.current = { drain, report };
  useEffect(() => {
    if (!isTauri() || isMobileOS()) return;
    let disposed = false,
      off: (() => void) | undefined,
      pending: Promise<void> | null = null;
    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const unsubscribe = await getCurrentWindow().onCloseRequested(
          async (event) => {
            try {
              pending ??= handlers.current.drain();
              await pending;
            } catch (error) {
              event.preventDefault();
              handlers.current.report(error);
            } finally {
              pending = null;
            }
          },
        );
        if (disposed) unsubscribe();
        else off = unsubscribe;
      })
      .catch((error) => handlers.current.report(error));
    return () => {
      disposed = true;
      off?.();
    };
  }, []);
}
