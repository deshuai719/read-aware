import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  capturePositionContext,
  findUniqueQuoteRange,
  restoreReaderPosition,
} from "./position-recovery";
import type { FoliateView } from "./foliate-engine";
const quote = "A unique synthetic reading passage.";
function fixture(html: string[]) {
  const windows = html.map(() => new Window());
  const w = {
      happyDOM: {
        close: () =>
          Promise.all(windows.map((window) => window.happyDOM.close())),
      },
    },
    docs = html.map((value, i) => {
      const doc = windows[i].document;
      doc.body.innerHTML = value;
      return doc;
    });
  let calls: string[] = [],
    fraction: number | null = null;
  const view = {
    book: { sections: docs.map((doc) => ({ createDocument: () => doc })) },
    goTo: async (value: string) => {
      calls.push(value);
      return value === "recovered" ? { index: 0, anchor: null } : undefined;
    },
    goToFraction: async (value: number) => {
      fraction = value;
    },
    getCFI: (_index: number, range: Range) => {
      expect(range.toString()).toBe(quote);
      return "recovered";
    },
    renderer: { next: async () => {} },
  } as unknown as FoliateView;
  return {
    w,
    docs,
    view,
    calls,
    get fraction() {
      return fraction;
    },
  };
}
const source = { sourceSha256: "same", textEncoding: "auto" };
test("fallback maps an exact quote across original text-node offsets", async () => {
  const f = fixture([
    "<p>Prefix A unique <em>synthetic</em> reading passage. Suffix</p>",
  ]);
  const range = findUniqueQuoteRange(f.docs[0] as unknown as Document, quote)!;
  expect(range.toString()).toBe(quote);
  expect(range.startOffset).toBe(7);
  expect(range.endOffset).toBe(17);
  await f.w.happyDOM.close();
});
test("failed CFI recovers once from matching source context", async () => {
  const f = fixture(["<p>" + quote + "</p>"]);
  expect(
    await restoreReaderPosition({
      view: f.view,
      target: "broken",
      context: { ...source, sectionIndex: 0, quote, fraction: 0.3333 },
      fraction: 0.33,
      source,
    }),
  ).toBe("context");
  expect(f.calls).toEqual(["broken", "recovered"]);
  expect(f.fraction).toBeNull();
  await f.w.happyDOM.close();
});
test("different source/decoder never accepts old CFI or text; fraction remains available", async () => {
  const f = fixture(["<p>" + quote + "</p>"]);
  expect(
    await restoreReaderPosition({
      view: f.view,
      target: "old",
      context: { ...source, sectionIndex: 0, quote, fraction: 0.1 },
      fraction: 0.7,
      source: { ...source, sourceSha256: "new" },
    }),
  ).toBe("fraction");
  expect(f.calls).toEqual([]);
  expect(f.fraction).toBe(0.7);
  await f.w.happyDOM.close();
});
test("duplicates within or across neighboring sections refuse a confident recovery", async () => {
  for (const html of [
    ["<p>" + quote + quote + "</p>", "<p>" + quote + "</p>"],
    ["<p>" + quote + "</p>", "<p>" + quote + "</p>"],
  ]) {
    const f = fixture(html);
    expect(
      await restoreReaderPosition({
        view: f.view,
        target: null,
        context: { ...source, sectionIndex: 0, quote, fraction: 0.2 },
        fraction: 0.3,
        source,
      }),
    ).toBe("fraction");
    expect(f.calls).toEqual([]);
    expect(f.fraction).toBe(0.2);
    await f.w.happyDOM.close();
  }
});
test("cancelled recovery never navigates and capture stays bounded", async () => {
  const f = fixture(["<p>" + quote + "</p>"]);
  expect(
    await restoreReaderPosition({
      view: f.view,
      target: null,
      fraction: 0.5,
      source,
      cancelled: () => true,
    }),
  ).toBe("cancelled");
  expect(f.calls).toEqual([]);
  expect(f.fraction).toBeNull();
  const range = f.docs[0].createRange();
  range.selectNodeContents(f.docs[0].body);
  expect(
    capturePositionContext(
      {
        range: range as unknown as Range,
        section: { current: 0 },
        fraction: 0.3,
      },
      source,
    ).quote,
  ).toBe(quote);
  await f.w.happyDOM.close();
});
