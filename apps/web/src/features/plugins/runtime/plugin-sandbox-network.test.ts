import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("sandbox network fetch retains services namespace and reconstructs binary responses", () => {
  const worker = fileURLToPath(
    new URL("./plugin-sandbox.worker.ts", import.meta.url),
  );
  const plugin =
    'export default {async activate(ctx){const response=await ctx.services.network.fetch(new URL("http://127.0.0.1:9340/v1/audio/speech"),{method:"POST",headers:new Headers({"x-qa":"synthetic"}),body:"{}"});const bytes=new Uint8Array(await response.arrayBuffer());if(bytes[0]!==82||response.url!=="http://127.0.0.1:9340/v1/audio/speech")throw Error("binary response lost");}}';
  const url =
    "data:text/javascript;base64," + Buffer.from(plugin).toString("base64");
  const setup =
    'const messages=[];globalThis.self={postMessage(message){messages.push(message);if(message.t==="call")queueMicrotask(()=>self.onmessage({data:message.method==="services.network.fetch"?{t:"result",id:message.id,ok:true,value:{status:200,statusText:"OK",url:message.args[0],headers:{"content-type":"audio/wav"},body:new Uint8Array([82,73,70,70]).buffer}}:{t:"result",id:message.id,ok:false,error:"wrong-service-path"}}));}};await import(' +
    JSON.stringify(worker) +
    ');await self.onmessage({data:{t:"boot",url:' +
    JSON.stringify(url) +
    ',manifest:{id:"tts"},appVersion:"qa",capabilities:{},shape:{services:{network:{fetch:"fn"}}},storage:{},locale:"en",phase:"active"}});console.log(JSON.stringify({method:messages.find(m=>m.t==="call")?.method,ready:messages.some(m=>m.t==="ready"),error:messages.find(m=>m.t==="failed")?.error}));';
  const child = Bun.spawnSync([process.execPath, "--eval", setup], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    timeout: 20000,
  });
  if (child.exitCode !== 0) throw Error(child.stderr.toString());
  expect(JSON.parse(child.stdout.toString())).toEqual({
    method: "services.network.fetch",
    ready: true,
  });
});
