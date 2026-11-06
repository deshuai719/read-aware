import { expect, test } from "bun:test";
import {
  scanLibraryText,
  type LibraryScanPorts,
  type LibraryTextEvent,
} from "./library-full-text";
import type { LibraryBook, Collection } from "./library-types";
const book = (id: string, collectionId: string | null = null) =>
  ({ id, title: id, format: "epub", collectionId }) as LibraryBook;
const hit = {
  index: 0,
  label: "Chapter",
  subitems: [
    { cfi: "cfi", excerpt: { pre: "before", match: "needle", post: "after" } },
  ],
};
async function collect(
  ports: LibraryScanPorts,
  signal = new AbortController().signal,
  max = 500,
) {
  const items: LibraryTextEvent[] = [];
  for await (const item of scanLibraryText(ports, "needle", signal, max))
    items.push(item);
  return items;
}
test("locked sources are never opened; scan remains sequential and carries exact CFIs", async () => {
  const books = [book("a"), book("locked", "c"), book("b")],
    opened: string[] = [],
    disposed: string[] = [];
  let active = 0,
    max = 0;
  const events = await collect({
    books: async () => books,
    collections: async () =>
      [{ id: "c", passwordHash: "hash" }] as Collection[],
    open: async (b) => {
      opened.push(b.id);
      active++;
      max = Math.max(max, active);
      return {
        sourceSha256: b.id,
        search: async function* () {
          yield hit;
          yield hit;
        },
        dispose: async () => {
          disposed.push(b.id);
          active--;
        },
      };
    },
  });
  expect(opened).toEqual(["a", "b"]);
  expect(disposed).toEqual(["a", "b"]);
  expect(max).toBe(1);
  expect(
    events
      .filter((e) => e.type === "hit")
      .map((e) => (e.type === "hit" ? e.hit.cfi : "")),
  ).toEqual(["cfi", "cfi"]);
});
test("locking between streamed matches stops disclosure and still disposes the source", async () => {
  let locked = false,
    disposed = 0;
  const locks = async () =>
    locked ? ([{ id: "c", passwordHash: "hash" }] as Collection[]) : [];
  const ports: LibraryScanPorts = {
    books: async () => [book("a", "c")],
    collections: locks,
    open: async () => ({
      sourceSha256: "source",
      search: async function* () {
        yield {
          ...hit,
          subitems: [...hit.subitems, { ...hit.subitems[0], cfi: "second" }],
        };
      },
      dispose: async () => {
        disposed++;
      },
    }),
  };
  const iterator = scanLibraryText(
    ports,
    "needle",
    new AbortController().signal,
  );
  const first = await iterator.next();
  expect(first.value?.type).toBe("hit");
  locked = true;
  const rest = [];
  for await (const e of iterator) rest.push(e);
  expect(rest.filter((e) => e.type === "hit")).toHaveLength(0);
  expect(disposed).toBe(1);
});
test("cancellation and result limits release scanner resources without a false complete claim", async () => {
  const abort = new AbortController();
  let disposed = 0;
  const ports: LibraryScanPorts = {
    books: async () => [book("a")],
    collections: async () => [],
    open: async () => ({
      sourceSha256: "source",
      search: async function* () {
        yield hit;
      },
      dispose: async () => {
        disposed++;
      },
    }),
  };
  const i = scanLibraryText(ports, "needle", abort.signal);
  await i.next();
  abort.abort();
  expect((await i.next()).done).toBe(true);
  expect(disposed).toBe(1);
  const e = await collect(ports, new AbortController().signal, 1);
  expect(e[e.length - 1]).toEqual({ type: "done", limited: true });
  expect(disposed).toBe(2);
});
test("missing local source and section warnings keep partial results honest", async () => {
  const events = await collect({
    books: async () => [book("a"), book("b")],
    collections: async () => [],
    open: async (b) =>
      b.id === "a"
        ? null
        : {
            sourceSha256: "b",
            search: async function* () {
              yield { warning: "timeout", index: 1 };
              yield hit;
            },
            dispose: async () => {},
          },
  });
  expect(events.filter((e) => e.type === "warning")).toHaveLength(2);
  expect(events.filter((e) => e.type === "hit")).toHaveLength(1);
});
