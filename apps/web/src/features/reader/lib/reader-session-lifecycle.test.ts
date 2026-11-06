import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const hook = fileURLToPath(
  new URL("../hooks/useReaderSession.ts", import.meta.url),
);
const db = fileURLToPath(
  new URL("../../library/lib/library-db.ts", import.meta.url),
);
const i18n = fileURLToPath(new URL("../../../i18n/index.ts", import.meta.url));
const virtual = fileURLToPath(
  new URL("../../plugins/lib/virtual-books.ts", import.meta.url),
);
function run(scenario: string) {
  const setup =
    'import {Window} from "happy-dom";import {mock} from "bun:test";import {createElement,act,useState} from "react";import {createRoot} from "react-dom/client";' +
    'const w=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator"])globalThis[key]=w[key];globalThis.window=w;globalThis.IS_REACT_ACT_ENVIRONMENT=true;' +
    'mock.module("@read-aware/ui/state",()=>({useLocalAtom:useState}));mock.module(' +
    JSON.stringify(i18n) +
    ",()=>({useTranslation:()=>({t:key=>key})}));" +
    "mock.module(" +
    JSON.stringify(virtual) +
    ",()=>({getVirtualBookBinding:()=>null}));" +
    'const books=new Map(),writes=[],replaced=[],optimistic=[],errors=[];let save=async(id,progress)=>{writes.push([id,progress.progressPercent]);const result={...books.get(id),progress,progressPercent:progress.progressPercent,readingStatus:"reading"};books.set(id,result);return result;};let opened=async id=>books.get(id);' +
    "mock.module(" +
    JSON.stringify(db) +
    ',()=>({resolveStoredBookFile:async()=>({status:"ok",file:new w.File(["synthetic"],"test.epub")}),markLibraryBookOpened:id=>opened(id),updateLibraryBookProgress:(id,value)=>save(id,value)}));' +
    "const {useReaderSession}=await import(" +
    JSON.stringify(hook) +
    ');let api;document.body.innerHTML="<div id=root></div>";const root=createRoot(document.getElementById("root"));const make=id=>({id,title:id,author:"",format:"epub",fileName:id+".epub",mimeType:"application/epub+zip",fileSize:10,createdAt:"2026-01-01",updatedAt:"2026-01-01",lastOpenedAt:null,progressPercent:0,readingStatus:"unread",progress:null});for(const id of ["a","b"])books.set(id,make(id));const pos=n=>({currentLocation:n,totalLocations:100,progressPercent:n,cfi:"cfi-"+n,href:"chapter"});' +
    'function Host(){api=useReaderSession({applyOptimisticProgress:(id,p)=>optimistic.push([id,p.progressPercent]),replaceBookInState:b=>replaced.push([b.id,b.progressPercent]),reportError:e=>errors.push(String(e))});return null;}await act(async()=>root.render(createElement(Host)));const open=async id=>{await act(async()=>{api.openReader(books.get(id));await Promise.resolve();});};await open("a");' +
    scenario +
    ";await act(async()=>root.unmount());await w.happyDOM.close();";
  const child = Bun.spawnSync([process.execPath, "--eval", setup], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("A/B switch drains A, stale A callbacks cannot target B, and reopening restores independent positions", () => {
  const result = run(
    'const old=api.handleEpubProgressChange;await act(async()=>api.handleEpubProgressChange(pos(30),"a"));await open("b");await act(async()=>{old(pos(80),"a");api.handleEpubProgressChange(pos(60),"b");});await act(async()=>await api.closeReader());await open("a");console.log(JSON.stringify({writes,book:api.selectedBook.id,percent:api.selectedBook.progressPercent,optimistic}));',
  );
  expect(result).toEqual({
    writes: [
      ["a", 30],
      ["b", 60],
    ],
    book: "a",
    percent: 30,
    optimistic: [
      ["a", 30],
      ["b", 60],
    ],
  });
}, 25000);
test("native close drain keeps unaccepted find preview out of durable progress, even with late callbacks", () => {
  const result = run(
    'await act(async()=>api.handleEpubProgressChange(pos(20),"a"));await act(async()=>api.setProgressSuspended(true));await act(async()=>api.handleEpubProgressChange(pos(90),"a"));await act(async()=>await api.drainProgress());await act(async()=>api.handleEpubProgressChange(pos(95),"a"));console.log(JSON.stringify({writes,optimistic,percent:api.selectedBook.progressPercent}));',
  );
  expect(result).toEqual({
    writes: [["a", 20]],
    optimistic: [["a", 20]],
    percent: 20,
  });
}, 25000);
test("failed shutdown preserves selected book and the pending accepted position for retry", () => {
  const result = run(
    'save=async()=>{throw new Error("disk failed")};await act(async()=>api.handleEpubProgressChange(pos(45),"a"));await act(async()=>{try{await api.closeReader()}catch{}});const still=api.selectedBook.id;save=async(id,p)=>{writes.push([id,p.progressPercent]);return {...books.get(id),progress:p,progressPercent:p.progressPercent}};await act(async()=>await api.closeReader());console.log(JSON.stringify({still,closed:api.selectedBook===null,writes,failed:errors.length>0}));',
  );
  expect(result).toEqual({
    still: "a",
    closed: true,
    writes: [["a", 45]],
    failed: true,
  });
}, 25000);
test("a late durable response cannot replace a newer optimistic position", () => {
  const result = run(
    'let finish,start;const started=new Promise(resolve=>start=resolve);save=(id,p)=>{writes.push([id,p.progressPercent]);start();return new Promise(resolve=>finish=()=>resolve({...books.get(id),progress:p,progressPercent:p.progressPercent}));};await act(async()=>{api.handleEpubProgressChange(pos(10),"a");api.setProgressSuspended(true);await started;});await act(async()=>{api.setProgressSuspended(false);api.handleEpubProgressChange(pos(25),"a");finish();await Promise.resolve();});console.log(JSON.stringify({percent:api.selectedBook.progressPercent,stale:replaced.some(([id,n])=>n===10)}));',
  );
  expect(result).toEqual({ percent: 25, stale: false });
}, 25000);
