import {expect,test} from "bun:test";
import {fileURLToPath} from "node:url";
const hook=fileURLToPath(new URL("../hooks/useReaderSearch.ts",import.meta.url));
const engine=fileURLToPath(new URL("./foliate-engine.ts",import.meta.url));
function run(scenario:string){
  const script='import {Window} from "happy-dom";import {mock} from "bun:test";import {createElement,act} from "react";import {createRoot} from "react-dom/client";'
    +'const window=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator"])globalThis[key]=window[key];globalThis.window=window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;'
    +'mock.module('+JSON.stringify(engine)+',()=>({loadDrawFns:async()=>({highlight:()=>null})}));const {useReaderSearch}=await import('+JSON.stringify(hook)+');'
    +'let calls=0,restores=0,clears=0,api,args=[],index=1;const hit=(cfi)=>({cfi,excerpt:{pre:"",match:"needle",post:""}});'
    +'const view={book:{},lastLocation:{cfi:"location"},resolveNavigation:async()=>({index}),getSectionFractions:()=>[0,0.5],clearSearch(){clears++},restoreSearchResults:async()=>{restores++},'
    +'search:async function*(options){calls++;args.push(options);yield {index:0,label:"Chapter",subitems:[hit("hit-"+calls)]};yield "done"}};const ref={current:view};'
    +'document.body.innerHTML="<div id=root></div>";const root=createRoot(document.getElementById("root"));function Host(){api=useReaderSearch({viewRef:ref,bookId:"synthetic-book"});return null};await act(async()=>root.render(createElement(Host)));await act(async()=>api.notifyReady());'
    +scenario+';await act(async()=>root.unmount());await window.happyDOM.close();';
  const child=Bun.spawnSync([process.execPath,"--eval",script],{cwd:fileURLToPath(new URL("../../../../",import.meta.url)),timeout:15000});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());return JSON.parse(child.stdout.toString());
}
test("dismiss remembers the query and cached results; reopen restores without a new scan",()=>{
  const result=run('await act(async()=>await api.runSearch("needle"));await act(async()=>api.setActiveIndex(0));await act(async()=>api.dismiss());const closed={query:api.getSnapshot().query,count:api.getSnapshot().results.length,visible:api.getSnapshot().visible};await act(async()=>await Promise.all([api.resume(),api.resume()]));console.log(JSON.stringify({closed,calls,restores,nav:api.getSnapshot().navRevision}));');
  expect(result).toEqual({closed:{query:"needle",count:1,visible:false},calls:1,restores:1,nav:1});
},20000);
test("load-more within an open find keeps the same streaming scan",()=>{
  const result=run('view.search=async function*(options){calls++;yield {index:0,label:"Chapter",subitems:Array.from({length:650},(_,i)=>hit("hit-"+i))};yield "done"};await act(async()=>await api.runSearch("needle"));const first=api.getSnapshot().results.length;await act(async()=>await api.loadMore());console.log(JSON.stringify({first,final:api.getSnapshot().results.length,calls,complete:api.getSnapshot().complete}));');
  expect(result).toEqual({first:500,final:650,calls:1,complete:true});
},20000);
test("scope and all-term semantics are captured before the reader moves",()=>{
  const result=run('await act(async()=>api.setOptions({scope:"chapter",mode:"all"}));await act(async()=>await api.runSearch("alpha beta"));index=0;console.log(JSON.stringify({scope:args[0].scopeIndex,terms:args[0].queryTerms,calls}));');
  expect(result).toEqual({scope:1,terms:["alpha","beta"],calls:1});
},20000);
test("a different parsed book invalidates cached search restoration",()=>{
  const result=run('await act(async()=>await api.runSearch("needle"));await act(async()=>api.dismiss());view.book={};await act(async()=>api.notifyReady());await act(async()=>await api.resume());console.log(JSON.stringify({calls,restores,cfi:api.getSnapshot().results[0]?.cfi}));');
  expect(result).toEqual({calls:2,restores:0,cfi:"hit-2"});
},20000);
test("an early search remains queued and replays after reader readiness",()=>{
  const result=run('view.book=undefined;await act(async()=>await api.runSearch("wanted"));const queued=api.getSnapshot().phase;view.book={};await act(async()=>{api.notifyReady();await new Promise(resolve=>setTimeout(resolve,10))});console.log(JSON.stringify({queued,calls,query:api.getSnapshot().query,count:api.getSnapshot().results.length}));');
  expect(result).toEqual({queued:"queued",calls:1,query:"wanted",count:1});
},20000);
test("an aborted old generation cannot append late metadata to a replacement query",()=>{
  const result=run('view.search=async function*(options){calls++;if(options.query==="old"){yield {index:0,label:"Chapter",subitems:[hit("old-first")]};await new Promise(resolve=>options.signal.addEventListener("abort",resolve,{once:true}));yield {index:0,label:"Chapter",subitems:[hit("old-late")]};}else yield {index:0,label:"Chapter",subitems:[hit("new-only")]};yield "done"};let old;await act(async()=>{old=api.runSearch("old");await new Promise(resolve=>setTimeout(resolve,10))});await act(async()=>{api.setQuery("new");await api.runSearch("new");await old});console.log(JSON.stringify({query:api.getSnapshot().query,cfis:api.getSnapshot().results.map(hit=>hit.cfi)}));');
  expect(result).toEqual({query:"new",cfis:["new-only"]});
},20000);
