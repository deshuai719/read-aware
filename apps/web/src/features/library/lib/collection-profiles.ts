/** Synchronous cached reads; roaming preferences publish once through the KV write observer. */
import { localKV } from "../../../platform/local-store";
import { orderAfterMove, type OrderedCollection } from "./collection-order";
import { applyCollectionOrder, cleanCollectionProfiles, type CollectionProfile, type CollectionProfiles } from "./collection-profile-data";
export type { CollectionProfile, CollectionProfiles } from "./collection-profile-data";
export const COLLECTION_PROFILES_KEY = "read-aware-collection-profiles";
export function readCollectionProfiles(): CollectionProfiles {
  try { return cleanCollectionProfiles(JSON.parse(localKV.getItem(COLLECTION_PROFILES_KEY) ?? "{}")); }
  catch { return {}; }
}
export function writeCollectionProfiles(profiles: CollectionProfiles): void {
  localKV.setItem(COLLECTION_PROFILES_KEY, JSON.stringify(cleanCollectionProfiles(profiles)));
}
export function updateCollectionProfile(id: string, patch: CollectionProfile): CollectionProfiles {
  const latest = readCollectionProfiles();
  const next = cleanCollectionProfiles({ ...latest, [id]: { ...latest[id], ...patch } });
  writeCollectionProfiles(next);
  return next;
}
export function removeCollectionProfile(id: string): CollectionProfiles {
  const next = { ...readCollectionProfiles() };
  delete next[id];
  writeCollectionProfiles(next);
  return next;
}
export function moveCollectionProfile<T extends OrderedCollection>(
  collections: T[], _profiles: CollectionProfiles, id: string, direction: -1 | 1,
): CollectionProfiles {
  const latest = readCollectionProfiles();
  const positions = orderAfterMove(collections, latest, id, direction);
  if (!positions) return latest;
  const next = applyCollectionOrder(latest, positions);
  writeCollectionProfiles(next);
  return next;
}
export { sortCollectionsByProfile } from "./collection-order";
