import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const hook = fileURLToPath(
  new URL("../hooks/useReadAloudEnvironment.ts", import.meta.url),
);
function run(scenario: string) {
  const code =
    'import {Window} from "happy-dom";import {createElement,act} from "react";import {createRoot} from "react-dom/client";const w=new Window();for(const key of ["document","HTMLElement","Node","MutationObserver","navigator","Event"])globalThis[key]=w[key];globalThis.window=w;globalThis.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(document,"visibilityState",{value:"visible",configurable:true});let now=1000;Date.now=()=>now;let tick;globalThis.setInterval=fn=>{tick=fn;return 1};globalThis.clearInterval=()=>{};let requested=0,released=0,resolve;Object.defineProperty(navigator,"wakeLock",{value:{request:()=>{requested++;return new Promise(r=>resolve=()=>r({release:async()=>{released++},addEventListener:()=>{}}))}},configurable:true});globalThis.MediaMetadata=class {constructor(value){Object.assign(this,value)}};const actions={};Object.defineProperty(navigator,"mediaSession",{value:{metadata:null,playbackState:"none",setActionHandler:(name,fn)=>actions[name]=fn},configurable:true});const {useReadAloudEnvironment}=await import(' +
    JSON.stringify(hook) +
    ');const root=createRoot(document.body.appendChild(document.createElement("div")));let remaining,stopped=0;const stop=()=>stopped++,noop=()=>{};const props={active:true,paused:false,title:"QA",sleepMinutes:5,stop,pause:noop,resume:noop,next:noop};function Host(){remaining=useReadAloudEnvironment(props);return null;}const render=async()=>await act(async()=>root.render(createElement(Host)));await render();' +
    scenario +
    ";await act(async()=>root.unmount());await w.happyDOM.close();";
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}
test("visibility storms share one pending wake request and late acquisition is released", () => {
  expect(
    run(
      'await act(async()=>{document.dispatchEvent(new Event("visibilitychange"));document.dispatchEvent(new Event("visibilitychange"));});const before=requested;await act(async()=>root.unmount());await act(async()=>{resolve();await Promise.resolve();});console.log(JSON.stringify({before,released}));',
    ),
  ).toEqual({ before: 1, released: 1 });
}, 25000);
test("missing MediaMetadata still installs media controls", () => {
  expect(
    run(
      'delete globalThis.MediaMetadata;props.title="Other QA";await render();console.log(JSON.stringify({pause:typeof actions.pause==="function"}));',
    ),
  ).toEqual({ pause: true });
}, 25000);
test("sleep is wall-clock based, pause retains deadline, disabling clears stale remaining", () => {
  expect(
    run(
      'now+=120000;await act(async()=>tick());const before=remaining;props.paused=true;await render();now+=60000;await act(async()=>tick());const paused=remaining;props.sleepMinutes=0;await render();console.log(JSON.stringify({before,paused,off:remaining,stopped,hasPause:typeof actions.pause==="function"}));',
    ),
  ).toEqual({ before: 3, paused: 2, off: null, stopped: 0, hasPause: true });
}, 25000);
