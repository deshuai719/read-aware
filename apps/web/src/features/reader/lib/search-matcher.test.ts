import { expect, test } from "bun:test";
const moduleUrl = new URL("../../../../public/foliate-js/search.js", import.meta.url).href;
const { searchMatcher } = await import(moduleUrl);
function match(texts: string[], terms: string[]) {
  const roots = texts.map(text => ({ text, querySelector: () => null }));
  const doc = { body: {lang:"en"}, documentElement: {lang:"en"}, querySelectorAll: () => roots };
  const walker = function* (_root: unknown, callback: (strings: string[], makeRange: (...args: number[]) => object) => Iterable<unknown>) {
    for (const root of roots) yield* callback([root.text], (...offsets: number[]) => ({offsets}));
  };
  return Array.from(searchMatcher(walker,{queryTerms:terms})(doc,terms[0]));
}
test("different words in one paragraph produce a real hit, not an empty CFI intersection",()=>expect(match(["Alice met Bob in the same paragraph."],["Alice","Bob"])).toHaveLength(1));
test("terms in different paragraphs are not silently accepted as AND",()=>expect(match(["Alice was here.","Bob was elsewhere."],["Alice","Bob"])).toHaveLength(0));
test("a missing later term cannot degrade into the first term results",()=>expect(match(["alpha ".repeat(510)],["alpha","nonexistent"])).toHaveLength(0));
test("all five terms are checked",()=>expect(match(["one two three four."],["one","two","three","four","five"])).toHaveLength(0));
