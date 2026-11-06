import { useEffect, useMemo, useState } from "react";
import type { TocEntry } from "../lib/reader-types";
import { tocAncestors, visibleTocIndices } from "../lib/toc-outline";
export function useTocOutline(
  entries: TocEntry[],
  currentIndex: number,
  bookId: string,
) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => setCollapsed(new Set()), [bookId]);
  useEffect(() => {
    const ancestors = new Set(tocAncestors(entries, currentIndex));
    setCollapsed(
      (current) => new Set([...current].filter((id) => !ancestors.has(id))),
    );
  }, [entries, currentIndex]);
  const indices = useMemo(
    () => visibleTocIndices(entries, collapsed),
    [entries, collapsed],
  );
  return {
    indices,
    collapsed,
    toggle: (id: string) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    expandAll: () => setCollapsed(new Set()),
    collapseAll: () =>
      setCollapsed(
        new Set(
          entries
            .filter((entry, i) => entries[i + 1]?.depth > entry.depth)
            .map((entry) => entry.id),
        ),
      ),
  };
}
