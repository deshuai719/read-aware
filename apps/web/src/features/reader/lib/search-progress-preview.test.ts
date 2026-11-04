import { expect, test } from "bun:test";
import { createSearchProgressPreview } from "./search-progress-preview";
test("preview does not alter durable progress and accepts only the latest relocation",()=>{
  const gate=createSearchProgressPreview<number>(); gate.begin();
  expect(gate.capture("book",60)).toBe(true); gate.capture("book",70);
  expect(gate.finish()).toEqual({bookId:"book",progress:70}); expect(gate.capture("book",75)).toBe(false);
});
test("return settles before resuming, so the accepted position is the returned origin",()=>{
  const gate=createSearchProgressPreview<string>();gate.begin();gate.capture("book","hit");gate.capture("book","exact-origin");
  expect(gate.finish()).toEqual({bookId:"book",progress:"exact-origin"});
});
test("book switches discard previous preview and reopening creates a new gate",()=>{
  const gate=createSearchProgressPreview<number>();gate.begin();gate.capture("old",90);gate.reset();
  expect(gate.finish()).toBeNull();gate.begin();expect(gate.capture("new",10)).toBe(true);
});
