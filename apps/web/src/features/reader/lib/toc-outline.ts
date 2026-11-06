import type { TocEntry } from "./reader-types";
export function tocAncestors(
  entries: readonly TocEntry[],
  index: number,
): string[] {
  const result: string[] = [];
  let depth = entries[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0; i--) {
    if (entries[i].depth < depth) {
      result.push(entries[i].id);
      depth = entries[i].depth;
    }
  }
  return result;
}
export function visibleTocIndices(
  entries: readonly TocEntry[],
  collapsed: ReadonlySet<string>,
): number[] {
  const visible: number[] = [];
  let hiddenDepth: number | null = null;
  entries.forEach((entry, index) => {
    if (hiddenDepth !== null && entry.depth > hiddenDepth) return;
    hiddenDepth = null;
    visible.push(index);
    if (collapsed.has(entry.id) && entries[index + 1]?.depth > entry.depth)
      hiddenDepth = entry.depth;
  });
  return visible;
}
