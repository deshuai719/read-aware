import { expect, test } from "bun:test";
import { applyCollectionOrder, cleanCollectionProfiles } from "./collection-profile-data";
test("ordering preserves a newly synchronized description and cover",()=>{
  const latest={a:{description:"remote",coverBookId:"cover"},b:{}};
  expect(applyCollectionOrder(latest,{a:1,b:0})).toEqual({a:{description:"remote",coverBookId:"cover",order:1},b:{order:0}});
  expect(latest.a.description).toBe("remote");
});
test("roaming profile parsing ignores invalid values rather than crashing",()=>{
  expect(cleanCollectionProfiles({a:null,b:"bad",c:{description:" text ",order:Infinity},d:{order:0}})).toEqual({c:{description:"text"},d:{order:0}});
});
test("clearing profile fields really removes their stale values",()=>{
  expect(cleanCollectionProfiles({a:{description:"",coverBookId:null,coverDataUrl:null}})).toEqual({});
});
