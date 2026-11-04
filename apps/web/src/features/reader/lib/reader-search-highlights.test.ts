import { expect, test } from "bun:test";
const viewUrl = new URL("../../../../public/foliate-js/view.js", import.meta.url).href;
function run(script: string) {
  const setup = 'globalThis.NodeFilter={SHOW_ELEMENT:1,SHOW_TEXT:4,SHOW_CDATA_SECTION:8,FILTER_REJECT:2,FILTER_SKIP:3,FILTER_ACCEPT:1};'
    + 'globalThis.HTMLElement=class extends EventTarget{attachShadow(){return {}}};globalThis.customElements={define(){}};'
    + 'const {View}=await import(' + JSON.stringify(viewUrl) + ');';
  const child=Bun.spawnSync([process.execPath,"--eval",setup+script]);
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("clearSearch invalidates a search paint already waiting for CFI resolution",()=>{
  const output=run('const view=new View();let ready;let paints=0;const pending=new Promise(resolve=>ready=resolve);'
    + 'view.resolveNavigation=async()=>{await pending;return {index:0,anchor:{}}};view.renderer={getContents:()=>[{index:0,overlayer:{add(){paints++},remove(){}}}]};'
    + 'const paint=view.addAnnotation({value:"foliate-search:pending"});view.clearSearch();ready();await paint;console.log(JSON.stringify({paints}));');
  expect(output.paints).toBe(0);
});
test("the real search highlight painter uses a fill without a red stroke",()=>{
  const url=new URL("../../../../public/foliate-js/overlayer.js",import.meta.url).href;
  const script='globalThis.document={createElementNS:(_,tag)=>({tag,attributes:{},style:{},children:[],setAttribute(k,v){this.attributes[k]=v},append(v){this.children.push(v)}})};'
    + 'const {Overlayer}=await import('+JSON.stringify(url)+');const fill=Overlayer.highlight([{left:0,top:0,width:60,height:16}],{color:"#f4d35e"});console.log(JSON.stringify(fill));';
  const child=Bun.spawnSync([process.execPath,"--eval",script]);
  if(child.exitCode!==0)throw new Error(child.stderr.toString());
  const mark=JSON.parse(child.stdout.toString());
  expect(mark.attributes.fill).toBe("#f4d35e");expect(mark.attributes.stroke).toBeUndefined();
  expect(mark.children[0].attributes["stroke-width"]).toBeUndefined();
});
