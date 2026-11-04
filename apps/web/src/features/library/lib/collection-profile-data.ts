export type CollectionProfile = { description?: string; coverBookId?: string | null; coverDataUrl?: string | null; order?: number };
export type CollectionProfiles = Record<string, CollectionProfile>;

export function cleanCollectionProfiles(value: unknown): CollectionProfiles {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const data = entry as Record<string, unknown>;
    const profile: CollectionProfile = {};
    if (typeof data.description === "string" && data.description.trim()) profile.description = data.description.trim().slice(0, 2000);
    if (typeof data.coverBookId === "string" && data.coverBookId) profile.coverBookId = data.coverBookId;
    if (typeof data.coverDataUrl === "string" && ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].some(prefix => (data.coverDataUrl as string).startsWith(prefix)) && data.coverDataUrl.length < 600_000) profile.coverDataUrl = data.coverDataUrl;
    if (typeof data.order === "number" && Number.isFinite(data.order)) profile.order = data.order;
    return Object.keys(profile).length ? [[id, profile]] : [];
  }));
}

export function applyCollectionOrder(latest: CollectionProfiles, positions: Record<string, number>): CollectionProfiles {
  const next = { ...latest };
  for (const [id, order] of Object.entries(positions)) next[id] = { ...latest[id], order };
  return next;
}
