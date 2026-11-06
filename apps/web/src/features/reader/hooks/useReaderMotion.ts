import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { FoliateView } from "../lib/foliate-engine";
import { readerAllowsMotion } from "../../settings/lib/reader-advanced";
export function useReaderMotion(
  viewRef: RefObject<FoliateView | null>,
  transition: "none" | "smooth" | undefined,
) {
  const transitionRef = useRef(transition);
  transitionRef.current = transition;
  const allows = useCallback(
    () =>
      readerAllowsMotion(
        transitionRef.current,
        document.documentElement.dataset.motion === "reduced" ||
          (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
            false),
      ),
    [],
  );
  const sync = useCallback(
    (renderer = viewRef.current?.renderer) => {
      if (!renderer) return;
      if (allows()) renderer.setAttribute("animated", "");
      else renderer.removeAttribute("animated");
    },
    [allows, viewRef],
  );
  useEffect(() => {
    const update = () => sync();
    update();
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    return () => {
      media?.removeEventListener?.("change", update);
      observer.disconnect();
    };
  }, [sync, transition]);
  return { allows, sync };
}
