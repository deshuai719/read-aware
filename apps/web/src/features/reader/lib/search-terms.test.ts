import { expect, test } from "bun:test";
import { splitSearchTerms } from "./search-terms";
test("all entered terms are retained rather than silently dropping the fifth",()=>expect(splitSearchTerms("one two three four five")).toEqual(["one","two","three","four","five"]));
test("quotes preserve an exact phrase",()=>expect(splitSearchTerms('"Alice met Bob" nearby')).toEqual(["Alice met Bob","nearby"]));
test("case-sensitive searches do not collapse differently cased terms",()=>{
  expect(splitSearchTerms("AI ai",true)).toEqual(["AI","ai"]);
  expect(splitSearchTerms("AI ai")).toEqual(["AI"]);
});
test("fullwidth spaces separate words without folding book characters",()=>expect(splitSearchTerms("Ａ　Bob")).toEqual(["Ａ","Bob"]));
