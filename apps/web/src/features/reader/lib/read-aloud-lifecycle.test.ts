import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const base = new URL("../hooks/", import.meta.url),
  hook = fileURLToPath(new URL("useReadAloud.ts", base)),
  prefs = fileURLToPath(new URL("useReadAloudPreferences.ts", base)),
  env = fileURLToPath(new URL("useReadAloudEnvironment.ts", base)),
  speech = fileURLToPath(new URL("../lib/read-aloud-speech.ts", base));
function run(scenario: string) {
  const code =
    'import {Window} from "happy-dom";import {mock} from "bun:test";import {createElement,act} from "react";import {createRoot} from "react-dom/client";const w=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator"])globalThis[key]=w[key];globalThis.window=w;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let callbacks,speaks=0,cancels=0,advances=0;const timers=new Map();let id=0;globalThis.setTimeout=fn=>{timers.set(++id,fn);return id};globalThis.clearTimeout=n=>timers.delete(n);mock.module(' +
    JSON.stringify(prefs) +
    ',()=>({useReadAloudPreferences:()=>({prefs:{voice:"system",rate:1,sleepMinutes:0},pluginVoice:null})}));mock.module(' +
    JSON.stringify(env) +
    ",()=>({useReadAloudEnvironment:()=>null}));mock.module(" +
    JSON.stringify(speech) +
    ",()=>({speechAvailable:()=>true,speakText:(text,cb)=>{callbacks=cb;speaks++;return {cancel:()=>cancels++,pause:()=>{},resume:()=>{}}}}));const {useReadAloud}=await import(" +
    JSON.stringify(hook) +
    ');const root=createRoot(document.body.appendChild(document.createElement("div")));let api;const props={bookId:"a",title:"QA",enabled:true,current:{text:"first",cfiRange:"cfi-first"},next:()=>advances++,peekNext:()=>null};function Host(){api=useReadAloud(props);return null;}const render=async()=>act(async()=>root.render(createElement(Host)));await render();await act(async()=>api.toggle());' +
    scenario +
    ";await act(async()=>root.unmount());await w.happyDOM.close();";
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("pause between units rearms end-of-book guard rather than hanging forever", () => {
  expect(
    run(
      "await act(async()=>callbacks.onEnd());await act(async()=>api.pause());const pendingWhilePaused=timers.size;await act(async()=>api.resume());const pendingAfterResume=timers.size;await act(async()=>{for(const fn of [...timers.values()])fn();});console.log(JSON.stringify({advances,pendingWhilePaused,pendingAfterResume,playing:api.playing,speaks}));",
    ),
  ).toEqual({
    advances: 1,
    pendingWhilePaused: 0,
    pendingAfterResume: 1,
    playing: false,
    speaks: 1,
  });
}, 25000);
test("late completion while paused is advanced once on resume and never speaks the stale unit", () => {
  expect(
    run(
      'await act(async()=>api.pause());await act(async()=>callbacks.onEnd());const before=advances;await act(async()=>api.resume());props.current={text:"next",cfiRange:"next"};await render();console.log(JSON.stringify({before,advances,speaks,guard:timers.size}));',
    ),
  ).toEqual({ before: 0, advances: 1, speaks: 2, guard: 0 });
}, 25000);
test("switching book releases playback and ignores old completion callbacks", () => {
  expect(
    run(
      'const old=callbacks;props.bookId="b";props.current={text:"other",cfiRange:"other"};await render();await act(async()=>old.onEnd());console.log(JSON.stringify({playing:api.playing,advances,cancelled:cancels>0}));',
    ),
  ).toEqual({ playing: false, advances: 0, cancelled: true });
}, 25000);
