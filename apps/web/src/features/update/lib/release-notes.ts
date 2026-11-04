/**
 * The release body as the post-upgrade notes. The landing site curates a
 * changelog registry, but it only knows stable releases of the upstream
 * project — any build published from this fork (v0.5.0-16 and friends) has no
 * entry there, so the dialog would fall back to a single line saying "some
 * things changed". The GitHub release for that exact tag carries the notes
 * (scripts/release-notes.ts writes them from the commit log), so the dialog
 * reads the release body next and renders it in the same shape as the
 * curated entry.
 *
 * Pure parsing + one network call; every failure resolves to null and the
 * caller keeps its one-line fallback.
 */
import type { ChangelogEntryText, ChangelogGroup, ChangelogGroupKind, WhatsNewEntry } from "./changelog-feed";

/** The repository the updater publishes to (tauri.conf.json `updater.endpoints`). */
export const RELEASE_REPO = "deshuai719/read-aware";

export const releaseByTagUrl = (repo: string, tag: string): string =>
  `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;

/** Section heading → the dialog's three groups. Unknown headings are dropped. */
const SECTION_KINDS: Record<string, ChangelogGroupKind> = {
  new: "new",
  added: "new",
  features: "new",
  feat: "new",
  improved: "improved",
  changed: "improved",
  performance: "improved",
  refactor: "improved",
  docs: "improved",
  fixed: "fixed",
  fix: "fixed",
  "bug fixes": "fixed",
  bugs: "fixed",
  other: "improved",
};

/** `**x**`, `__x__`, `*x*`, `` `x` ``, `[text](url)`, `~~x~~` → plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type RawItem = { title?: string; body: string };

/** `**reader**: in-book search` → title "reader", body "in-book search". */
function splitLeadIn(text: string): RawItem {
  const scoped = /^\*\*([^*]{1,40})\*\*\s*[:：,-]\s*(.+)$/.exec(text);
  if (scoped) return { title: stripMarkdown(scoped[1]!), body: stripMarkdown(scoped[2]!) };
  const bolded = /^\*\*([^*]{1,60})\.?\*\*\s*(.*)$/.exec(text);
  if (bolded && bolded[2] && bolded[2].trim()) {
    return { title: stripMarkdown(bolded[1]!), body: stripMarkdown(bolded[2]!) };
  }
  return { body: stripMarkdown(text) };
}

const isBullet = (line: string): boolean => /^\s*[-*+]\s+/.test(line);

/**
 * Parse a release body into the dialog's shape. Accepts the layout
 * scripts/release-notes.ts writes (`## New` / `## Improved` / `## Fixed` with
 * bullets), release-please's `### Features` / `### Bug Fixes`, and a bare
 * bullet list (which lands in New).
 */
export function parseReleaseNotes(markdown: string): ChangelogEntryText | null {
  const groups = new Map<ChangelogGroupKind, RawItem[]>();
  let current: ChangelogGroupKind | null = null;
  let sawHeading = false;
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^#{1,4}\s+(.+)$/.exec(line);
    if (heading) {
      sawHeading = true;
      const key = stripMarkdown(heading[1]!).toLowerCase().replace(/[:：]$/, "").trim();
      current = SECTION_KINDS[key] ?? null;
      continue;
    }
    if (!isBullet(line)) continue;
    const kind: ChangelogGroupKind = current ?? (sawHeading ? "improved" : "new");
    const item = splitLeadIn(line.replace(/^\s*[-*+]\s+/, ""));
    if (!item.body && !item.title) continue;
    groups.set(kind, [...(groups.get(kind) ?? []), item]);
  }

  const order: ChangelogGroupKind[] = ["new", "improved", "fixed"];
  const built: ChangelogGroup[] = [];
  for (const kind of order) {
    const items = groups.get(kind);
    if (items && items.length > 0) built.push({ kind, items });
  }
  if (built.length === 0) return null;

  // No summary is authored in a release body; lead with the first item's
  // sentence so the dialog's opening paragraph is never empty.
  const first = built[0]!.items[0]!;
  const summary = first.title ? `${first.title}: ${first.body}` : first.body;
  return { summary, groups: built };
}

type GithubRelease = { tag_name?: string; name?: string; body?: string; published_at?: string };

/**
 * Fetch the release for `version` and parse its body. Tries `v<version>` then
 * `<version>` — both tag styles exist in the wild. Null on any failure.
 */
export async function fetchReleaseNotes(
  version: string,
  fetchFn: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  repo: string = RELEASE_REPO,
  timeoutMs: number = 2_500,
): Promise<WhatsNewEntry | null> {
  const tags = version.startsWith("v") ? [version, version.slice(1)] : [`v${version}`, version];
  for (const tag of tags) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(releaseByTagUrl(repo, tag), {
        headers: { accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const release = (await response.json()) as GithubRelease;
      if (typeof release.body !== "string") continue;
      const text = parseReleaseNotes(release.body);
      if (!text) continue;
      return {
        version,
        codename: null,
        date: release.published_at ? release.published_at.slice(0, 10) : "",
        text,
      };
    } catch {
      // Try the next tag form; a network failure ends both attempts anyway.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
