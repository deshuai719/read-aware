import {fileURLToPath} from "node:url";
import {expect,test} from "bun:test";
const matcherUrl=new URL("../../../../public/foliate-js/search.js",import.meta.url).href;
const walkerUrl=new URL("../../../../public/foliate-js/text-walker.js",import.meta.url).href;
function searchDOM(html:string,query:string,options:Record<string,unknown>={}) {
  const source='import {Window} from "happy-dom";const window=new Window();globalThis.document=window.document;globalThis.NodeFilter=window.NodeFilter;document.body.innerHTML='+JSON.stringify(html)+';'
    +'const {searchMatcher}=await import('+JSON.stringify(matcherUrl)+');const walkers=await import('+JSON.stringify(walkerUrl)+');'
    +'const options='+JSON.stringify(options)+';if(options.noSegmenter)Intl.Segmenter=undefined;'
    +'const matcher=searchMatcher(walkers.blockTextWalker??walkers.textWalker,{defaultLocale:"en",...options});'
    +'const results=Array.from(matcher(document,'+JSON.stringify(query)+'),hit=>({selected:hit.range.toString(),...hit.excerpt}));console.log(JSON.stringify(results));await window.happyDOM.close();';
  const child=Bun.spawnSync([process.execPath,"--eval",source],{cwd:fileURLToPath(new URL("../../../../",import.meta.url))});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString()) as {selected:string;pre:string;match:string;post:string}[];
}
test("inline-node range excerpts keep every intermediate text node",()=>{
  const hit=searchDOM("<p>Before <span>ab</span><b>cd</b><i>ef</i> after</p>","abcdef")[0]!;
  expect(hit.selected).toBe("abcdef");expect(hit.match).toBe("abcdef");
});
test("an exact case-sensitive match at the final text offset does not overrun nodes",()=>{
  expect(searchDOM("<p>END</p>","END",{matchCase:true,matchDiacritics:true})[0]?.selected).toBe("END");
});
test("phrases cannot concatenate unrelated paragraphs",()=>expect(searchDOM("<p>abc</p><p>def</p>","abcdef")).toHaveLength(0));
test("all-term matching does not discard direct text around nested blocks",()=>{
  expect(searchDOM("<div>Alice <em>note</em><p>unrelated</p>tail</div>","Alice",{queryTerms:["Alice","note"]})).toHaveLength(1);
});
test("phrase whitespace is tolerant but the selected Range stays original",()=>{
  expect(searchDOM("<p>Alice\n met   Bob</p>","Alice met Bob")[0]?.selected).toBe("Alice\n met   Bob");
});
test("scripts and styles are not searchable prose",()=>expect(searchDOM("<p>needle</p><script>needle</script><style>needle</style>","needle")).toHaveLength(1));
test("all terms are required in the same real text block",()=>{
  expect(searchDOM("<p>ALPHA <em>needle</em> OMEGA</p>","alpha",{queryTerms:["alpha","omega"]})).toHaveLength(1);
  expect(searchDOM("<p>alpha</p><p>omega</p>","alpha",{queryTerms:["alpha","omega"]})).toHaveLength(0);
});
test("fallback folding preserves original offsets before an expanded character",()=>{
  expect(searchDOM("<p>İ abc</p>","abc",{noSegmenter:true})[0]?.selected).toBe("abc");
});

test("the non-Segmenter whole-word fallback does not match an embedded fragment",()=>{
  expect(searchDOM("<p>concatenate</p>","cat",{matchWholeWords:true,noSegmenter:true})).toHaveLength(0);
});
