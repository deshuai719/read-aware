import {expect,test} from "bun:test";
import {DEFAULT_SEARCH_OPTIONS,readerSearchTerms,readerSearchKey} from "./reader-search-query";
import {readerFindDirection} from "./reader-find-keys";
test("default phrase preserves spaces and quotes as typed text",()=>expect(readerSearchTerms('  Alice met Bob  ',DEFAULT_SEARCH_OPTIONS)).toEqual(['Alice met Bob']));
test("all-word mode deliberately enables token and quoted-phrase parsing",()=>expect(readerSearchTerms('Alice "met Bob"',{...DEFAULT_SEARCH_OPTIONS,mode:"all"})).toEqual(['Alice','met Bob']));
test("scope and matching options are part of the cache key",()=>{
  expect(readerSearchKey('word',DEFAULT_SEARCH_OPTIONS,null)).not.toBe(readerSearchKey('word',{...DEFAULT_SEARCH_OPTIONS,scope:"chapter"},1));
});
test("find shortcuts respect Shift and do not steal AltGr/composition",()=>{
  const key={key:"F3",ctrlKey:false,metaKey:false,altKey:false,shiftKey:false};
  expect(readerFindDirection(key)).toBe(1);expect(readerFindDirection({...key,shiftKey:true})).toBe(-1);
  expect(readerFindDirection({...key,key:"g",ctrlKey:true,altKey:true})).toBeNull();expect(readerFindDirection({...key,isComposing:true})).toBeNull();
});
