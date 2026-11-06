import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("reading-time backup preserves tick ids and observes clocks before idempotent commit", () => {
  const hook = fileURLToPath(
      new URL("./reading-time-backup.ts", import.meta.url),
    ),
    environment = fileURLToPath(new URL("./environment.ts", import.meta.url)),
    domain = fileURLToPath(new URL("./domain-events.ts", import.meta.url));
  const child = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      'import {mock} from "bun:test";const calls=[],tick={id:"tick-id",type:"book.timeRecorded",hlc:{wallMs:123,counter:0,deviceId:"peer"},payload:{bookId:"qa",ms:10}};mock.module("@tauri-apps/api/core",()=>({invoke:async(name,args)=>{calls.push([name,args]);return name==="read_events_since"?[tick,{...tick,type:"note.created"}]:{};}}));mock.module(' +
        JSON.stringify(environment) +
        ",()=>({isTauri:()=>true}));mock.module(" +
        JSON.stringify(domain) +
        ',()=>({observeRemoteHlcStamps:stamps=>calls.push(["observe",stamps])}));const mod=await import(' +
        JSON.stringify(hook) +
        ");const events=await mod.exportReadingTimeEvents();await mod.restoreReadingTimeEvents(events);console.log(JSON.stringify({count:events.length,id:events[0].id,order:calls.map(c=>c[0]),same:calls[2][1].events[0].id===tick.id}));",
    ],
    { cwd: fileURLToPath(new URL("../../", import.meta.url)), timeout: 20000 },
  );
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  expect(JSON.parse(child.stdout.toString())).toEqual({
    count: 1,
    id: "tick-id",
    order: ["read_events_since", "observe", "commit_events"],
    same: true,
  });
});
