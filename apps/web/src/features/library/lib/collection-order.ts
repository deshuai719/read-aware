/**
 * Collection ordering, kept pure so it can be tested without touching storage.
 * Persistence lives next door in collection-profiles.ts.
 */

export type OrderedCollection = { id: string; name: string };

/** The slice of a collection profile that affects ordering. */
export type OrderMap = Record<string, { order?: number } | undefined>;

function orderOf(profiles: OrderMap, id: string): number {
  return profiles[id]?.order ?? Infinity;
}

/**
 * Collections as the shelf should list them: manual order first, then by name.
 * An un-ordered collection keeps its name position instead of jumping to the
 * end, so adding one new collection does not reshuffle everything else.
 */
export function sortCollectionsByProfile<T extends OrderedCollection>(
  collections: T[],
  profiles: OrderMap,
): T[] {
  const byName = [...collections].sort((a, b) => a.name.localeCompare(b.name));
  const nameRank = new Map(byName.map((collection, index) => [collection.id, index]));
  return [...collections].sort((a, b) => {
    const ao = orderOf(profiles, a.id);
    const bo = orderOf(profiles, b.id);
    if (ao !== bo) return ao - bo;
    return (nameRank.get(a.id) ?? 0) - (nameRank.get(b.id) ?? 0);
  });
}

/**
 * The order to persist after moving one collection a step up (-1) or down (+1).
 * Every collection gets an explicit position, so the result is stable — a
 * half-ordered list would drift back as soon as another collection is added.
 * Null when the move is not possible (already at the edge).
 */
export function orderAfterMove<T extends OrderedCollection>(
  collections: T[],
  profiles: OrderMap,
  id: string,
  direction: -1 | 1,
): Record<string, number> | null {
  const ordered = sortCollectionsByProfile(collections, profiles);
  const index = ordered.findIndex((collection) => collection.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const next = [...ordered];
  [next[index], next[target]] = [next[target]!, next[index]!];
  const result: Record<string, number> = {};
  next.forEach((collection, position) => {
    result[collection.id] = position;
  });
  return result;
}
