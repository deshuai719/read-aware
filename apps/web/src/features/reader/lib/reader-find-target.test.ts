import {expect,test} from "bun:test";
import {readerFindTarget} from "./reader-find-target";
test("next at a partial page boundary asks for more instead of prematurely wrapping",()=>expect(readerFindTarget(500,499,1,true)).toEqual({index:null,loadMore:true,wrapped:false}));
test("next wraps only after known results are exhausted",()=>expect(readerFindTarget(50,49,1,false)).toEqual({index:0,loadMore:false,wrapped:true}));
test("backward wrap is explicit and bounded to currently loaded results",()=>expect(readerFindTarget(50,0,-1,true)).toEqual({index:49,loadMore:false,wrapped:true}));
test("first command and empty results have defined targets",()=>{
  expect(readerFindTarget(20,-1,1,true).index).toBe(0);expect(readerFindTarget(20,-1,-1,true).index).toBe(19);expect(readerFindTarget(0,-1,1,false).index).toBeNull();
});
