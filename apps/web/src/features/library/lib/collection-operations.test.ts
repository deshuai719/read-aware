import { describe, expect, test } from "bun:test";
import { assertBookCollectionAccess, collectionMergeEvents } from "./collection-operations";
import type { Collection } from "./library-types";
const collections: Collection[] = [{ id: "source", name: "S", createdAt: "now" }, { id: "target", name: "T", createdAt: "now" }];
describe("collection merge transaction plan", () => {
  test("moves only source members and removes source LAST in the same batch", () => {
    expect(collectionMergeEvents([{id:"a",collectionId:"source"},{id:"b",collectionId:"target"}],collections,"source","target")).toEqual([
      {type:"book.addedToCollection",payload:{bookId:"a",collectionId:"target"}},
      {type:"collection.removed",payload:{collectionId:"source"}},
    ]);
  });
  test("rejects locked source or target before producing removal", () => {
    for (const id of ["source","target"]) expect(() => collectionMergeEvents([],collections.map(c=>c.id===id?{...c,passwordHash:"locked"}:c),"source","target")).toThrow("collection-locked");
  });
  test("rejects missing target and self merge", () => {
    expect(()=>collectionMergeEvents([],collections,"source","gone")).toThrow("collection-not-found");
    expect(()=>collectionMergeEvents([],collections,"source","source")).toThrow("collection-merge-self");
  });
  test("execution-level book guard covers locked source memberships",()=>{
    expect(()=>assertBookCollectionAccess([{collectionId:"source"}],collections.map(c=>({...c,passwordHash:"locked"})))).toThrow("collection-locked");
  });
});
