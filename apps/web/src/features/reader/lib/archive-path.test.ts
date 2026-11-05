import {fileURLToPath} from "node:url";
import {expect,test} from "bun:test";
const root=fileURLToPath(new URL("../../../../",import.meta.url));
const run=(scenario:string)=>{
  const script='const {resolveEntry,pathVariants}=await import('+JSON.stringify(new URL("../../../../public/foliate-js/archive-path.js",import.meta.url).href)+');'+scenario+';';
  const child=Bun.spawnSync([process.execPath,"--eval",script],{cwd:root,timeout:15000});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
};
test("a percent-encoded href resolves to the literal filename",()=>{
  const out=run('const map=new Map([["chapter 1.xhtml","x"]]);console.log(JSON.stringify(resolveEntry(map,"chapter%201.xhtml")))');
  expect(out).toBe("x");
});
// Windows archivers write entry names with backslashes; no spec allows it and
// every mainstream reader accepts it anyway.
test("a backslash entry name still resolves from a forward-slash href",()=>{
  const out=run('const bs=String.fromCharCode(92);const name="META-INF"+bs+"container.xml";'
    +'const map=new Map([[name,"c"]]);'
    +'console.log(JSON.stringify({forward:resolveEntry(map,"META-INF/container.xml"),variants:pathVariants(name)}))');
  expect(out.forward).toBe("c");
  expect(out.variants).toContain("META-INF/container.xml");
});
test("case differences between manifest and archive resolve",()=>{
  const out=run('const map=new Map([["OEBPS/Book.opf","b"]]);console.log(JSON.stringify(resolveEntry(map,"oebps/book.opf")))');
  expect(out).toBe("b");
});
test("a genuinely missing entry stays missing",()=>{
  const out=run('const map=new Map([["a.xhtml","a"]]);console.log(JSON.stringify(resolveEntry(map,"b.xhtml")))');
  expect(out).toBeNull();
});
