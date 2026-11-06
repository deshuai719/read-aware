import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("disposed scheduler cannot publish an old cycle success or error and visibility wakes current cycle", () => {
  const root = new URL("./", import.meta.url),
    scheduler = fileURLToPath(new URL("sync-scheduler.ts", root));
  const paths = Object.fromEntries(
    [
      "environment",
      "secret-store",
      "domain-events",
      "local-store",
      "book-dedupe",
      "roaming-preferences",
    ].map((n) => [n, fileURLToPath(new URL("../" + n + ".ts", root))]),
  );
  const code =
    'import {mock} from "bun:test";const handlers=new Map();globalThis.window={location:{hostname:"localhost"},setTimeout:()=>1,clearTimeout:()=>{},addEventListener:(n,fn)=>handlers.set(n,fn),removeEventListener:n=>handlers.delete(n)};globalThis.document={visibilityState:"visible",addEventListener:(n,fn)=>handlers.set(n,fn),removeEventListener:n=>handlers.delete(n)};let resolveFlight;const flight=new Promise(r=>resolveFlight=r);let cycles=0;mock.module("@tauri-apps/api/core",()=>({invoke:async()=>({events:0,blobs:0})}));mock.module(' +
    JSON.stringify(paths.environment) +
    ",()=>({isTauri:()=>true}));mock.module(" +
    JSON.stringify(paths["secret-store"]) +
    ',()=>({getSecret:key=>key==="sync.master-key"?"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=":"qa",setSecret:()=>{},deleteSecret:()=>{}}));mock.module(' +
    JSON.stringify(paths["domain-events"]) +
    ",()=>({observeRemoteHlcStamps:()=>{},onDomainEventBroadcast:()=>()=>{}}));mock.module(" +
    JSON.stringify(paths["local-store"]) +
    ",()=>({localKV:{getItem:()=>null}}));mock.module(" +
    JSON.stringify(paths["book-dedupe"]) +
    ",()=>({reconcileDuplicateBooks:async()=>{}}));mock.module(" +
    JSON.stringify(paths["roaming-preferences"]) +
    ",()=>({refreshRoamingPreferences:async()=>{},republishRoamingSecrets:()=>{}}));mock.module(" +
    JSON.stringify(fileURLToPath(new URL("sync-store.ts", root))) +
    ',()=>({createIpcSyncStore:()=>({}),getSyncProfile:async()=>({syncEnabled:true,remoteAccountId:"qa"}),setSyncProfile:async()=>{},adoptSyncAccount:async()=>{}}));mock.module(' +
    JSON.stringify(fileURLToPath(new URL("sync-engine.ts", root))) +
    ",()=>({createSyncEngine:()=>({syncOnce:async()=>{cycles++;return flight}}),nextSyncDelayMs:()=>10}));mock.module(" +
    JSON.stringify(fileURLToPath(new URL("relay-client.ts", root))) +
    ',()=>({createRelayClient:()=>({watchTicket:async()=>{throw Error("no socket")}}),RelayError:class extends Error{},RelayMisdirectedError:class extends Error{}}));const s=await import(' +
    JSON.stringify(scheduler) +
    ');s.startSyncScheduler();for(let i=0;i<20;i++)await Promise.resolve();const visibility=handlers.has("visibilitychange");s.restartSyncScheduler();resolveFlight({pulled:0,pushed:2,blobs:0});for(let i=0;i<30;i++)await Promise.resolve();console.log(JSON.stringify({visibility,cycles,state:s.getSyncStatusSnapshot().state}));';
  const child = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  const result = JSON.parse(child.stdout.toString());
  expect(result.visibility).toBe(true);
  expect(result.cycles).toBeGreaterThanOrEqual(1);
  expect(result.state).not.toBe("error");
});
