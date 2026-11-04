import {expect,test} from "bun:test";
import {ReaderSearchSession} from "./reader-search-session";
import type {FoliateSearchYield} from "./foliate-engine";
const batch=(start:number,count:number)=>({index:0,label:"Chapter",subitems:Array.from({length:count},(_,i)=>({cfi:"hit-"+(start+i),excerpt:{pre:"",match:"needle",post:""}}))});
test("load more continues the same iterator beyond500 instead of rescanning",async()=>{
  let starts=0;async function* iter():AsyncGenerator<FoliateSearchYield>{starts++;yield batch(0,650);yield batch(650,25);yield "done";}
  const session=new ReaderSearchSession(iter(),[0],()=>{});const first=await session.readMore();
  expect(first.results).toHaveLength(500);expect(first.hasMore).toBe(true);
  const rest=await session.readMore();expect(rest.results).toHaveLength(675);expect(rest.complete).toBe(true);expect(starts).toBe(1);
});
test("stream snapshots publish useful first hits before later waits",async()=>{
  let release!:()=>void;const later=new Promise<void>(resolve=>release=resolve);const seen:number[]=[];
  async function* iter():AsyncGenerator<FoliateSearchYield>{yield batch(0,1);await later;yield "done";}
  const session=new ReaderSearchSession(iter(),[0],page=>{seen.push(page.results.length);if(page.results.length)release();});
  await session.readMore();expect(seen).toContain(1);
});
test("duplicate CFIs and repeated warnings are deduplicated in book order",async()=>{
  async function* iter():AsyncGenerator<FoliateSearchYield>{yield batch(0,3);yield batch(1,4);yield {warning:"unavailable",index:2};yield {warning:"timeout",index:2};yield "done";}
  const page=await new ReaderSearchSession(iter(),[0],()=>{}).readMore();
  expect(page.results.map(hit=>hit.cfi)).toEqual(["hit-0","hit-1","hit-2","hit-3","hit-4"]);expect(page.warningIndices).toEqual([2]);
});
test("two concurrent load-more clicks share one page request",async()=>{
  async function* iter():AsyncGenerator<FoliateSearchYield>{yield batch(0,700);yield "done";}
  const session=new ReaderSearchSession(iter(),[0],()=>{});const a=session.readMore(),b=session.readMore();expect(a).toBe(b);expect((await a).results).toHaveLength(500);
});
test("a resumed partial session ignores already cached prefixes",async()=>{
  async function* iter():AsyncGenerator<FoliateSearchYield>{yield batch(0,5);yield "done";}
  const seed=batch(0,3).subitems.map(hit=>({cfi:hit.cfi,...hit.excerpt,sectionIndex:0,chapter:"Chapter",fraction:0}));
  const page=await new ReaderSearchSession(iter(),[0],()=>{},{results:seed,warningIndices:[]}).readMore();expect(page.results).toHaveLength(5);
});
test("a fatal iterator error keeps earlier hits but is not a clean no-match",async()=>{
  async function* iter():AsyncGenerator<FoliateSearchYield>{yield batch(0,1);throw new Error("scan failed");}
  const page=await new ReaderSearchSession(iter(),[0],()=>{}).readMore();expect(page.results).toHaveLength(1);expect(page.error).toBe("scan failed");expect(page.complete).toBe(false);
});
