import { describe, expect, test } from "bun:test";
import type { Id } from "@read-aware/core";
import { createInMemoryDeps } from "../testing/fixtures";
import { createAgentRuntime } from "./runtime";

function makeRuntime() {
  const { deps, stores } = createInMemoryDeps();
  let memoryLists = 0;
  const listMemories = deps.memory.listMemories;
  deps.memory.listMemories = async () => {
    memoryLists += 1;
    return listMemories();
  };
  const runtime = createAgentRuntime({
    deps,
    account: { kind: "api-key", provider: "openai", apiKey: "test-key" },
    models: { smart: "test-smart", fast: "test-fast" },
  });
  return { runtime, stores, memoryLists: () => memoryLists };
}

describe("AgentRuntime maintenance", () => {
  test("inflight one-shot inference forwards abort to transport and rejects late completion", async () => {
    const { deps } = createInMemoryDeps();
    const abort = new AbortController();
    let started!: () => void;
    const flight = new Promise<void>((resolve) => {
      started = resolve;
    });
    let received: AbortSignal | undefined,
      aborted = false;
    const runtime = createAgentRuntime({
      deps,
      account: {
        kind: "api-key",
        provider: "custom-openai",
        apiKey: "synthetic",
        baseUrl: "http://127.0.0.1:9340/v1",
        api: "openai-completions",
      },
      models: { smart: "qa", fast: "qa" },
      fetch: async (_input, init) => {
        received = init?.signal ?? undefined;
        started();
        return new Promise<Response>((_resolve, reject) => {
          received?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const request = runtime.ask({
      prompt: "Synthetic translation",
      signal: abort.signal,
    });
    await flight;
    abort.abort();
    await expect(request).rejects.toThrow();
    expect(received?.aborted).toBe(true);
    expect(aborted).toBe(true);
  });
  test("pre-aborted one-shot requests never resolve a model or call inference", async () => {
    const { runtime } = makeRuntime();
    const abort = new AbortController();
    abort.abort();
    await expect(
      runtime.ask({
        prompt: "Translate a synthetic sentence",
        signal: abort.signal,
      }),
    ).rejects.toThrow("ask-aborted");
  });
  test("idle consolidation runs once while memory stays unchanged", async () => {
    const { runtime, memoryLists } = makeRuntime();

    expect(await runtime.consolidateIfNeeded()).not.toBeNull();
    expect(await runtime.consolidateIfNeeded()).toBeNull();
    expect(memoryLists()).toBe(1);

    await runtime.consolidate();
    expect(memoryLists()).toBe(2);
  });

  test("discardThread removes only the selected cached agent state and summary", async () => {
    const { runtime, stores } = makeRuntime();
    const book = { kind: "book" as const, bookId: "book-1" as Id };
    const other = { kind: "book" as const, bookId: "book-2" as Id };
    const first = runtime.thread(book);
    const untouched = runtime.thread(other);
    stores.insights.set("book:book-1", "old hidden context");
    stores.insights.set("book:book-2", "keep this context");

    await runtime.discardThread(book);

    expect(runtime.thread(book)).not.toBe(first);
    expect(runtime.thread(other)).toBe(untouched);
    expect(stores.insights.get("book:book-1")).toBeUndefined();
    expect(stores.insights.get("book:book-2")).toBe("keep this context");
  });
});
