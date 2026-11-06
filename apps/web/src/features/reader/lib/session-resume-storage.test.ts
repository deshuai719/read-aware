import { expect, test } from "bun:test";
import { readLastReaderSession, saveLastReaderSession } from "./session-resume";
test("explicit shelf shutdown differs from missing legacy session metadata", () => {
  const data = new Map<string, string>();
  const before = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    },
  });
  try {
    expect(readLastReaderSession()).toBeUndefined();
    saveLastReaderSession("book");
    expect(readLastReaderSession()).toBe("book");
    saveLastReaderSession(null);
    expect(readLastReaderSession()).toBeNull();
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: before,
    });
  }
});
