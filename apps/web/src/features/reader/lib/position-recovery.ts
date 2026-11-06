import type { ReadingPositionContext } from "@read-aware/core";
import type { FoliateView } from "./foliate-engine";
export type RecoverySource = {
  sourceSha256: string | null;
  textEncoding: string;
};
export type PositionRecoveryResult =
  | "locator"
  | "context"
  | "fraction"
  | "start"
  | "cancelled";
const MAX_SECTION_TEXT = 2_000_000,
  MAX_SECTIONS = 3,
  SECTION_TIMEOUT = 1200;
export function sameRecoverySource(
  context: ReadingPositionContext,
  source: RecoverySource,
): boolean {
  return (
    !!context.sourceSha256 &&
    context.sourceSha256 === source.sourceSha256 &&
    (context.textEncoding ?? "auto") === source.textEncoding
  );
}
/** Walk ORIGINAL text nodes; never normalize offsets or rewrite the reading document. */
function quoteMatch(
  doc: Document,
  quote: string,
): { range: Range | null; ambiguous: boolean } {
  if (quote.trim().length < 16 || quote.length > 240)
    return { range: null, ambiguous: true };
  const nodes: Text[] = [],
    starts: number[] = [];
  let text = "";
  const walk = doc.createTreeWalker(doc.body ?? doc.documentElement, 4);
  let node: Node | null;
  while ((node = walk.nextNode())) {
    const parent = node.parentElement;
    if (parent?.closest("script,style,noscript,[hidden]")) continue;
    const value = node.nodeValue ?? "";
    if (text.length + value.length > MAX_SECTION_TEXT)
      return { range: null, ambiguous: true };
    starts.push(text.length);
    nodes.push(node as Text);
    text += value;
  }
  const start = text.indexOf(quote);
  if (start < 0) return { range: null, ambiguous: false };
  if (text.indexOf(quote, start + 1) >= 0)
    return { range: null, ambiguous: true };
  const end = start + quote.length;
  const first = starts.findIndex(
    (offset, i) => offset <= start && offset + nodes[i].length > start,
  );
  const last = starts.findIndex(
    (offset, i) => offset < end && offset + nodes[i].length >= end,
  );
  if (first < 0 || last < 0) return { range: null, ambiguous: true };
  const range = doc.createRange();
  range.setStart(nodes[first], start - starts[first]);
  range.setEnd(nodes[last], end - starts[last]);
  return { range, ambiguous: false };
}
export function findUniqueQuoteRange(
  doc: Document,
  quote: string,
): Range | null {
  return quoteMatch(doc, quote).range;
}
export function capturePositionContext(
  detail: {
    range?: Range;
    index?: number;
    section?: { current?: number };
    fraction?: number;
  },
  source: RecoverySource,
): ReadingPositionContext {
  const index = detail.index ?? detail.section?.current;
  return {
    ...source,
    ...(Number.isInteger(index) && index! >= 0 ? { sectionIndex: index } : {}),
    ...(detail.range
      ? { quote: Array.from(detail.range.toString()).slice(0, 160).join("") }
      : {}),
    ...(typeof detail.fraction === "number" && Number.isFinite(detail.fraction)
      ? { fraction: Math.max(0, Math.min(1, detail.fraction)) }
      : {}),
  };
}
async function bounded<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SECTION_TIMEOUT);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export async function restoreReaderPosition({
  view,
  target,
  context,
  fraction,
  source,
  cancelled = () => false,
}: {
  view: FoliateView;
  target: string | null;
  context?: ReadingPositionContext;
  fraction: number;
  source: RecoverySource;
  cancelled?: () => boolean;
}): Promise<PositionRecoveryResult> {
  const knownChange =
    (context?.sourceSha256 && context.sourceSha256 !== source.sourceSha256) ||
    (context?.textEncoding && context.textEncoding !== source.textEncoding);
  if (target && !knownChange) {
    try {
      const landed = await view.goTo(target, { recordHistory: false });
      if (cancelled()) return "cancelled";
      if (landed) {
        const quote = context?.quote;
        const actual = view.lastLocation?.range?.toString();
        if (
          !quote ||
          !sameRecoverySource(context!, source) ||
          actual?.startsWith(quote)
        )
          return "locator";
      }
    } catch {}
  }
  if (cancelled()) return "cancelled";
  if (
    context &&
    sameRecoverySource(context, source) &&
    context.quote &&
    Number.isInteger(context.sectionIndex)
  ) {
    const sections = view.book?.sections as
      | { createDocument?: () => Promise<Document> | Document }[]
      | undefined;
    const indices = [
      context.sectionIndex!,
      context.sectionIndex! - 1,
      context.sectionIndex! + 1,
    ]
      .filter((i) => i >= 0 && i < (sections?.length ?? 0))
      .slice(0, MAX_SECTIONS);
    const matches: { index: number; range: Range }[] = [];
    let uncertain = false;
    for (const index of indices) {
      if (cancelled()) return "cancelled";
      try {
        const doc = await bounded(
          Promise.resolve(sections?.[index].createDocument?.()),
        );
        if (doc) {
          const match = quoteMatch(doc, context.quote);
          uncertain ||= match.ambiguous;
          if (match.range) matches.push({ index, range: match.range });
        } else uncertain = true;
      } catch {
        uncertain = true;
      }
    }
    if (cancelled()) return "cancelled";
    if (!uncertain && matches.length === 1) {
      try {
        const { index, range } = matches[0];
        const cfi = view.getCFI(index, range);
        if (await view.goTo(cfi, { recordHistory: false }))
          return cancelled() ? "cancelled" : "context";
      } catch {}
    }
  }
  if (cancelled()) return "cancelled";
  const saved =
    context &&
    sameRecoverySource(context, source) &&
    typeof context.fraction === "number"
      ? context.fraction
      : fraction;
  if (saved > 0) {
    await view.goToFraction(Math.max(0, Math.min(1, saved)), {
      recordHistory: false,
    });
    return cancelled() ? "cancelled" : "fraction";
  }
  await view.renderer?.next();
  return cancelled() ? "cancelled" : "start";
}
