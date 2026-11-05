import {fileURLToPath} from "node:url";
import {expect,test} from "bun:test";
const root=fileURLToPath(new URL("../../../../",import.meta.url));
const run=(scenario:string)=>{
  const script='import {Window} from "happy-dom";const window=new Window();'
    +'const {parseXML,sanitizeXML}=await import('+JSON.stringify(new URL("../../../../public/foliate-js/xml.js",import.meta.url).href)+');'
    +'const parser=new window.DOMParser();'+scenario+';await window.happyDOM.close();';
  const child=Bun.spawnSync([process.execPath,"--eval",script],{cwd:root,timeout:15000});
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
};
// The book that exposed this ships "上中下 & 彻底崩溃" inside dc:description.
// Browsers reject the bare "&"; happy-dom is lenient, so the escaping itself is
// asserted directly and the real engine is exercised in the native check.
const OPF='<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:description>上中下 & 彻底崩溃 & 第11-14章</dc:description></metadata></package>';
test("the broken OPF description is escaped and reads back as literal text",()=>{
  const out=run('const broken='+JSON.stringify(OPF)+';const sanitized=sanitizeXML(broken);'
    +'const doc=parseXML(parser,broken);const desc=[...doc.getElementsByTagName("dc:description")][0];'
    +'console.log(JSON.stringify({sanitized,error:!!doc.querySelector("parsererror"),text:desc.textContent}));');
  expect(out.sanitized).toContain("上中下 &amp; 彻底崩溃 &amp; 第11-14章");
  expect(out.error).toBe(false);
  expect(out.text).toBe("上中下 & 彻底崩溃 & 第11-14章");
});
test("HTML-only entities become numeric references and valid ones stay untouched",()=>{
  const out=run('console.log(JSON.stringify({nbsp:sanitizeXML("a&nbsp;b"),amp:sanitizeXML("A &amp; B"),numeric:sanitizeXML("x&#160;y"),hex:sanitizeXML("x&#xA0;y"),unknown:sanitizeXML("a & b &nosuchentity; c")}));');
  expect(out.nbsp).toBe("a&#160;b");
  expect(out.amp).toBe("A &amp; B");
  expect(out.numeric).toBe("x&#160;y");
  expect(out.hex).toBe("x&#xA0;y");
  expect(out.unknown).toBe("a &amp; b &amp;nosuchentity; c");
});
test("control characters from a text export are dropped instead of breaking the parse",()=>{
  const out=run('const ctl=String.fromCharCode(0)+"b"+String.fromCharCode(31)+"c";console.log(JSON.stringify(sanitizeXML("a"+ctl+"\\td")));');
  expect(out).toBe("abc\td");
});
test("a well-formed document is returned from the strict pass",()=>{
  const out=run('const ok=\'<package xmlns="http://www.idpf.org/2007/opf"><metadata/></package>\';const doc=parseXML(parser,ok);console.log(JSON.stringify({error:!!doc.querySelector("parsererror"),root:doc.documentElement.tagName}));');
  expect(out).toEqual({error:false,root:"package"});
});
