import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const fontStore = fileURLToPath(
    new URL("./local-font-store.ts", import.meta.url),
  ),
  kv = fileURLToPath(
    new URL("../../../platform/local-store.ts", import.meta.url),
  ),
  blobs = fileURLToPath(
    new URL("../../../platform/blob-store.ts", import.meta.url),
  ),
  events = fileURLToPath(
    new URL("../../../platform/app-events.ts", import.meta.url),
  );
function run(scenario: string) {
  const code =
    'import {mock} from "bun:test";const id="11111111-2222-4333-8444-555555555555";const meta={id,name:"QA",format:"woff2",sha256:"old",byteSize:12};let hasMeta=true,hasBytes=true,fail=false,reads=0,created=0,revoked=0;mock.module(' +
    JSON.stringify(kv) +
    ",()=>({localKV:{entries:()=>hasMeta?{[id]:JSON.stringify(meta)}:{}},replaceLocalKVPrefix:async(prefix,entries)=>{hasMeta=Object.keys(entries).length>0;}}));mock.module(" +
    JSON.stringify(blobs) +
    ',()=>({getDesktopBlob:async()=>{reads++;await Promise.resolve();return hasBytes?new Uint8Array([119,79,70,50,0,0,0,0,0,0,0,0]):null},deleteDesktopBlob:async()=>{if(fail)throw Error("disk");hasBytes=false;},putDesktopBlob:async()=>({sha256:"new",byteSize:12}),putDesktopBlobFromPath:async()=>{}}));mock.module(' +
    JSON.stringify(events) +
    ',()=>({emitAppEvent:()=>{}}));globalThis.FontFace=class{load=async()=>this};globalThis.document={getElementById:()=>null};URL.createObjectURL=()=>"blob:"+(++created);URL.revokeObjectURL=()=>revoked++;const fonts=await import(' +
    JSON.stringify(fontStore) +
    ");" +
    scenario;
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("concurrent font injections share one loaded CSS asset and deletion releases it", () => {
  expect(
    run(
      'const css=await Promise.all([fonts.ensureLocalFontFaceCss("local:"+id),fonts.ensureLocalFontFaceCss("local:"+id)]);await fonts.removeLocalReadingFont(id);console.log(JSON.stringify({same:css[0]===css[1],reads,created,revoked,hasMeta,hasBytes}));',
    ),
  ).toEqual({
    same: true,
    reads: 1,
    created: 1,
    revoked: 1,
    hasMeta: false,
    hasBytes: false,
  });
});
test("missing font bytes and deletion failure stay retryable", () => {
  expect(
    run(
      'hasBytes=false;let missing=false;try{await fonts.ensureLocalFontFaceCss("local:"+id)}catch{missing=true;}hasBytes=true;fail=true;try{await fonts.removeLocalReadingFont(id)}catch{}const retained=hasMeta;fail=false;const css=await fonts.ensureLocalFontFaceCss("local:"+id);console.log(JSON.stringify({missing,retained,loaded:!!css}));',
    ),
  ).toEqual({ missing: true, retained: true, loaded: true });
});
