import {fileURLToPath} from "node:url";
import {expect,test} from "bun:test";
const viewUrl=new URL("../../../../public/foliate-js/view.js",import.meta.url).href;
function run(scenario:string) {
  const setup='import {Window} from "happy-dom";const window=new Window();for(const key of ["document","HTMLElement","customElements","NodeFilter"])globalThis[key]=window[key];'
    +'const {View}=await import('+JSON.stringify(viewUrl)+');const windows=[window];const doc=(html)=>{const w=new Window();windows.push(w);w.document.body.innerHTML=html;return w.document};'
    +'const view=document.createElement("foliate-view");view.renderer={getContents:()=>[]};view.language={canonical:"en"};';
  const child=Bun.spawnSync([process.execPath,"--eval",setup+scenario+';await Promise.all(windows.map(w=>w.happyDOM.close()));'],{cwd:fileURLToPath(new URL("../../../../",import.meta.url))});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("first hits stream before a blocked later chapter is even requested",()=>{
  const output=run('let later=false;view.book={sections:[{createDocument:async()=>doc("<p>needle</p>")},{createDocument:()=>{later=true;return new Promise(()=>{})}}]};const iter=view.search({query:"needle"});let hit;for(let i=0;i<3;i++){const n=await iter.next();if(n.value?.subitems){hit=n.value;break}}console.log(JSON.stringify({count:hit?.subitems.length,later}));await iter.return();');
  expect(output).toEqual({count:1,later:false});
});
test("chapter scope reads only the captured section",()=>{
  const output=run('const reads=[];view.book={sections:[0,1,2].map(index=>({createDocument:async()=>{reads.push(index);return doc("<p>needle</p>")}}))};const hits=[];for await(const item of view.search({query:"needle",scopeIndex:1})){if(item.subitems)hits.push(item.index)}console.log(JSON.stringify({reads,hits}));');
  expect(output).toEqual({reads:[1],hits:[1]});
});
test("a bad chapter yields coverage warning and does not hide later hits",()=>{
  const output=run('view.book={sections:[{createDocument:async()=>{throw new Error("bad")}}, {createDocument:async()=>doc("<p>needle</p>")}]};let warnings=0,hits=0;for await(const item of view.search({query:"needle"})){if(item.warning)warnings++;if(item.subitems)hits+=item.subitems.length}console.log(JSON.stringify({warnings,hits}));');
  expect(output).toEqual({warnings:1,hits:1});
});
test("abort releases a pending chapter read instead of waiting for its promise",()=>{
  const output=run('const controller=new AbortController();view.book={sections:[{createDocument:()=>new Promise(()=>{})}]};const iter=view.search({query:"needle",signal:controller.signal});await iter.next();const pending=iter.next();controller.abort();const result=await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(new Error("abort stalled")),300))]);console.log(JSON.stringify({finished:result.done||result.value==="done"}));await iter.return();');
  expect(output.finished).toBe(true);
});
test("restored markers are tracked and clear keeps user annotations",()=>{
  const output=run('const document0=doc("<p>needle</p>");const marks=new Set(["user-annotation"]);view.book={sections:[{createDocument:async()=>document0}]};view.renderer={getContents:()=>[{index:0,doc:document0,overlayer:{add:key=>marks.add(key),remove:key=>marks.delete(key)}}]};const hits=[];for await(const batch of view.search({query:"needle"}))if(batch.subitems)for(const hit of batch.subitems)hits.push({index:batch.index,cfi:hit.cfi});view.clearSearch();await view.restoreSearchResults(hits);const restored=marks.size;view.clearSearch();console.log(JSON.stringify({restored,remaining:Array.from(marks)}));');
  expect(output.restored).toBe(2);expect(output.remaining).toEqual(["user-annotation"]);
});
test("one EPUB file can contain several chapters bounded by TOC anchors",()=>{
  const output=run('view.book={sections:[{createDocument:async()=>doc("<h2 id=a>A</h2><p>needle A</p><h2 id=b>B</h2><p>needle B</p>")}]};const hits=[];for await(const item of view.search({query:"needle",scopeSpan:{startIndex:0,endIndex:0,startAnchor:d=>d.getElementById("a"),endAnchor:d=>d.getElementById("b")}}))if(item.subitems)hits.push(...item.subitems);console.log(JSON.stringify({count:hits.length,match:hits[0]?.excerpt.match}));');
  expect(output).toEqual({count:1,match:"needle"});
});
test("a chapter can span multiple EPUB spine files",()=>{
  const output=run('view.book={sections:[0,1,2].map(i=>({createDocument:async()=>doc(i===2?"<h2 id=end>Next</h2><p>needle next</p>":"<p>needle chapter</p>")}))};const indices=[];for await(const item of view.search({query:"needle",scopeSpan:{startIndex:0,endIndex:2,endAnchor:d=>d.getElementById("end")}}))if(item.subitems)indices.push(item.index);console.log(JSON.stringify(indices));');
  expect(output).toEqual([0,1]);
});
test("terms outside a clipped chapter range cannot satisfy AND inside it",()=>{
  const output=run('view.book={sections:[{createDocument:async()=>doc("<p>outside <span id=a>inside needle</span> tail <span id=b>outside needle</span></p>")}]};let count=0;for await(const item of view.search({query:"inside",queryTerms:["inside","outside"],scopeSpan:{startIndex:0,endIndex:0,startAnchor:d=>d.getElementById("a"),endAnchor:d=>d.getElementById("b")}}))if(item.subitems)count+=item.subitems.length;console.log(JSON.stringify(count));');
  expect(output).toBe(0);
});
test("document-start chapter anchors exclude the next document instead of adding it",()=>{
  const output=run('view.book={sections:[0,1].map(i=>({createDocument:async()=>doc("<p>needle</p>")}))};const indices=[];for await(const item of view.search({query:"needle",scopeSpan:{startIndex:0,endIndex:1,startAnchor:()=>0,endAnchor:()=>0}}))if(item.subitems)indices.push(item.index);console.log(JSON.stringify(indices));');
  expect(output).toEqual([0]);
});
