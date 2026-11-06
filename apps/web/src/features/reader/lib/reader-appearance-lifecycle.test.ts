import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const hook = fileURLToPath(
  new URL("../hooks/useReaderAppearance.ts", import.meta.url),
);
const state = fileURLToPath(new URL("../../../state/ui.ts", import.meta.url));
test("appearance edits preserve newer decoder and TTS values in the same render batch", () => {
  const code =
    'import {Window} from "happy-dom";import {mock} from "bun:test";import {atom,createStore,Provider} from "jotai";import {createElement,act} from "react";import {createRoot} from "react-dom/client";const w=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator"])globalThis[key]=w[key];globalThis.window=w;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const preferences=atom({theme:"warm",fontFamily:"sans",fontSize:"medium",fontWeight:"regular",lineSpacing:"comfortable",paragraphSpacing:"normal",textAlign:"book",pageMargins:"wide",readingMode:"paginated-double",fixedLayoutColor:"original"});const overrides=atom({a:{scope:"book",settings:{...preferences.init},readAloud:{voice:"system",rate:1,sleepMinutes:0}}});const theme=atom("light");mock.module(' +
    JSON.stringify(state) +
    ",()=>({readerOverridesAtom:overrides,readerPreferencesAtom:preferences,resolvedAppThemeAtom:theme}));const {useReaderAppearance}=await import(" +
    JSON.stringify(hook) +
    ');const store=createStore(),root=createRoot(document.body.appendChild(document.createElement("div")));let a,b;function Host(){a=useReaderAppearance("a");b=useReaderAppearance("b");return null;}await act(async()=>root.render(createElement(Provider,{store},createElement(Host))));await act(async()=>{a.setTextEncoding("big5");store.set(overrides,current=>({...current,a:{...current.a,readAloud:{voice:"system",rate:1.5,sleepMinutes:5}}}));a.updatePrefs({...a.prefs,fontSize:"large"});b.setScope("book");});console.log(JSON.stringify(store.get(overrides)));await act(async()=>root.unmount());await w.happyDOM.close();';
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  const result = JSON.parse(child.stdout.toString());
  expect(result.a.textEncoding).toBe("big5");
  expect(result.a.readAloud.rate).toBe(1.5);
  expect(result.a.settings.fontSize).toBe("large");
  expect(result.b.scope).toBe("book");
}, 25000);
