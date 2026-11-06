import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const hooks = new URL("../hooks/", import.meta.url);
const path = (relative: string) =>
  JSON.stringify(fileURLToPath(new URL(relative, hooks)));
test("slow font completion cannot replace newer styles or touch a disposed renderer", () => {
  const code =
    'import {Window} from "happy-dom";import {mock} from "bun:test";import {atom} from "jotai";import {createElement,act} from "react";import {createRoot} from "react-dom/client";const w=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator"])globalThis[key]=w[key];globalThis.window=w;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const loads=[];mock.module(' +
    path("../../settings/lib/local-font-store.ts") +
    ",()=>({ensureLocalFontFaceCss:()=>new Promise(resolve=>loads.push(resolve))}));mock.module(" +
    path("../../settings/lib/reader-settings.ts") +
    ",()=>({curatedFontId:()=>null,isPluginFont:()=>false}));mock.module(" +
    path("../../settings/lib/reader-css.ts") +
    ",()=>({buildReaderContentCss:settings=>settings.marker,readerFontWeightsNeeded:()=>[],computeReaderMaxInlineSize:()=>500,readerGapForMargins:()=>20}));mock.module(" +
    path("../../plugins/state/plugin-store.ts") +
    ",()=>({pluginFontsAtom:atom([]),pluginThemesAtom:atom([])}));mock.module(" +
    path("../../../platform/app-events.ts") +
    ",()=>({onAppEvent:()=>()=>{}}));const {useReaderTypography}=await import(" +
    path("useReaderTypography.ts") +
    ');const writes=[];const renderer={setStyles:css=>writes.push(css),setAttribute:()=>{}};const viewRef={current:{renderer}};const root=createRoot(document.body.appendChild(document.createElement("div")));let api;const settings={fontFamily:"sans",theme:"warm",marker:"initial"};const props={readerSettings:settings,viewRef,readerRootRef:{current:null},viewportRef:{current:null},isFixedLayoutRef:{current:false},readingModeRef:{current:"paginated-double"},layoutForReadingMode:()=>({maxColumnCount:2})};function Host(){api=useReaderTypography(props);return null;}await act(async()=>root.render(createElement(Host)));const slow=api.injectStyles({...settings,fontFamily:"local:slow",marker:"old"});await api.injectStyles({...settings,marker:"new"});loads.shift()("font-face");await slow;const afterRace=[...writes];const disposed=api.injectStyles({...settings,fontFamily:"local:disposed",marker:"disposed"});await act(async()=>root.unmount());loads.shift()("font-face");await disposed;console.log(JSON.stringify({afterRace,writes}));await w.happyDOM.close();';
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  const result = JSON.parse(child.stdout.toString());
  expect(result.afterRace).toEqual(["initial", "new"]);
  expect(result.writes).toEqual(result.afterRace);
}, 25000);
