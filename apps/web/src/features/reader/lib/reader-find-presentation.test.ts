import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
// Isolate translation mocking in a short-lived process; never poison the shared test module cache.
function renderFind(query: string) {
  const component = fileURLToPath(new URL("../components/ReaderSearchBar.tsx", import.meta.url));
  const i18n = fileURLToPath(new URL("../../../i18n/index.ts", import.meta.url));
  const script = 'import {mock} from "bun:test"; import {renderToStaticMarkup} from "react-dom/server"; import {createElement} from "react";'
    + 'mock.module(' + JSON.stringify(i18n) + ',()=>({useTranslation:()=>({t:(key)=>key}),formatPercent:(n)=>String(n)}));'
    + 'const {ReaderSearchBar}=await import(' + JSON.stringify(component) + '); const noop=()=>{}; const query=' + JSON.stringify(query) + ';'
    + 'const search={query,resultsQuery:query,results:query?[{cfi:"hit",pre:"Before ",match:"needle",post:" after",sectionIndex:0,chapter:"Chapter",fraction:0.5}]:[],progress:null,running:false,truncated:false,activeIndex:0,options:{matchCase:false,matchWholeWords:false,mode:"phrase",scope:"book"},complete:true,hasMore:false,limitReached:false,warningIndices:[],navRevision:0,intentRevision:0,phase:"done",visible:true,wrappedDirection:null,terms:[],missingTerm:null,error:null,setQuery:noop,runSearch:noop,setActiveIndex:noop,setOptions:noop,clear:noop,jumpTo:noop,isReady:()=>true,canReturn:false,returnToPosition:noop};'
    + 'console.log(renderToStaticMarkup(createElement(ReaderSearchBar,{open:true,search,focusRequestId:0,onClose:noop})));';
  const child = Bun.spawnSync([process.execPath, "--eval", script], {cwd: fileURLToPath(new URL("../../../../",import.meta.url)), timeout: 15000});
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return child.stdout.toString();
}
test("opening find with an empty query does not render an options row or result surface",()=>{
  const html=renderFind("");
  expect(html).not.toContain("search.matchCase");
  expect(html).not.toContain("search.matchWholeWords");
  expect(html).not.toContain("data-search-result=");
},20000);
test("a completed query does not automatically open a long result list",()=>{
  const html=renderFind("needle");
  expect(html).not.toContain("data-search-result=");
  expect(html).not.toContain("<mark");
},20000);
test("ten thousand results render only a bounded virtual window",()=>{
  const component=fileURLToPath(new URL("../components/ReaderSearchResults.tsx",import.meta.url));
  const i18n=fileURLToPath(new URL("../../../i18n/index.ts",import.meta.url));
  const script='import {mock} from "bun:test";import {createElement} from "react";import {renderToStaticMarkup} from "react-dom/server";'
    +'mock.module('+JSON.stringify(i18n)+',()=>({useTranslation:()=>({t:key=>key})}));const {ReaderSearchResults}=await import('+JSON.stringify(component)+');'
    +'const results=Array.from({length:10000},(_,i)=>({cfi:"hit-"+i,pre:"",match:"needle",post:"",chapter:"Chapter",sectionIndex:0,fraction:0}));'
    +'console.log(renderToStaticMarkup(createElement(ReaderSearchResults,{search:{results,activeIndex:0,warningIndices:[],hasMore:false,limitReached:false,running:false},onSelect:()=>{}})));';
  const child=Bun.spawnSync([process.execPath,"--eval",script],{cwd:fileURLToPath(new URL("../../../../",import.meta.url)),timeout:15000});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  expect((child.stdout.toString().match(/data-search-result=/g)??[]).length).toBeLessThanOrEqual(12);
},20000);
test("find without reader chrome uses the top safe band instead of covering the first text row",()=>{
  const html=renderFind("");expect(html).toContain("pointer-events-auto fixed");expect(html).toContain("0.5rem");expect(html).not.toContain("3.5rem");
},20000);
