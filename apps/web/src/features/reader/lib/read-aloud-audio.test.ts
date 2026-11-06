import { expect, test } from "bun:test";
import { playAudioBytes } from "./read-aloud-audio";
test("encoded audio pause resumes from the original buffer offset and cancellation never ends the unit", async () => {
  const original = globalThis.AudioContext;
  let created: FakeSource[] = [];
  class FakeSource {
    buffer: any;
    playbackRate = { value: 1 };
    onended: (() => void) | null = null;
    offset = 0;
    connect() {}
    disconnect() {}
    stop() {}
    start(_at: number, offset: number) {
      this.offset = offset;
    }
  }
  class FakeContext {
    currentTime = 0;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    decodeAudioData() {
      return Promise.resolve({ duration: 20 });
    }
    createBufferSource() {
      const source = new FakeSource();
      created.push(source);
      return source;
    }
  }
  let context: FakeContext;
  globalThis.AudioContext = class extends FakeContext {
    constructor() {
      super();
      context = this;
    }
  } as unknown as typeof AudioContext;
  try {
    let ends = 0;
    const h = playAudioBytes(
      new ArrayBuffer(8),
      { onEnd: () => ends++, onError: () => {} },
      1.5,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(created[0].playbackRate.value).toBe(1.5);
    context!.currentTime = 2;
    h.pause();
    expect(created[0].onended).toBeNull();
    h.resume();
    await Promise.resolve();
    expect(created[1].offset).toBe(3);
    h.cancel();
    expect(created[1].onended).toBeNull();
    expect(ends).toBe(0);
  } finally {
    globalThis.AudioContext = original;
  }
});
