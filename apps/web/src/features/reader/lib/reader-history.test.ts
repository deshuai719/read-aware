import { expect, test } from "bun:test";
const url = new URL("../../../../public/foliate-js/history.js", import.meta.url)
  .href;
async function make(navigate: (target: unknown) => Promise<void>) {
  const { History } = await import(url);
  return new History(navigate);
}
test("history serializes repeated backward commands and forward branches", async () => {
  const landed: unknown[] = [];
  const h = await make(async (target) => {
    landed.push(target);
  });
  h.pushState("a");
  h.pushState("b");
  h.pushState("c");
  await Promise.all([h.back(), h.back()]);
  expect(landed).toEqual(["b", "a"]);
  await h.forward();
  h.pushState("new");
  expect(h.canGoForward).toBe(false);
});
test("navigation failure keeps the pointer and allows retry", async () => {
  let fail = true;
  const h = await make(async () => {
    if (fail) throw new Error("unreadable");
  });
  h.pushState("a");
  h.pushState("b");
  await expect(h.back()).rejects.toThrow("unreadable");
  expect(h.canGoBack).toBe(true);
  expect(h.canGoForward).toBe(false);
  fail = false;
  await h.back();
  expect(h.canGoForward).toBe(true);
});
test("session reset invalidates an in-flight return without resurrecting entries", async () => {
  let finish!: () => void, start!: () => void;
  const started = new Promise<void>((resolve) => (start = resolve));
  const h = await make(() => {
    start();
    return new Promise((resolve) => (finish = resolve));
  });
  h.pushState("a");
  h.pushState("b");
  const pending = h.back();
  await started;
  h.clear();
  finish();
  await pending;
  expect(h.canGoBack).toBe(false);
  expect(h.canGoForward).toBe(false);
});
test("ordinary page movement replaces the waypoint and zero fractions deduplicate", async () => {
  const landed: unknown[] = [];
  const h = await make(async (t) => {
    landed.push(t);
  });
  h.pushState({ fraction: 0 });
  h.pushState({ fraction: 0 });
  expect(h.canGoBack).toBe(false);
  h.replaceState("last-read-page");
  h.pushState("chapter");
  await h.back();
  expect(landed).toEqual(["last-read-page"]);
});
