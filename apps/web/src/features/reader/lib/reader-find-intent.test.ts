import {expect,test} from "bun:test";
import {panelRevealsReaderChrome} from "../state/panel-intent";
test("find does not reveal the obstructive full reader toolbar",()=>expect(panelRevealsReaderChrome("search")).toBe(false));
test("normal panels still reveal their reader chrome",()=>{
  for(const kind of ["toc","chat","appearance","annotations"] as const) expect(panelRevealsReaderChrome(kind)).toBe(true);
});
