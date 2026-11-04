#!/usr/bin/env bun
/**
 * Release notes for a tag, written from the commits since the previous tag.
 *
 * GitHub's `generate_release_notes` only lists merged pull requests, so a fork
 * that pushes straight to main gets a body consisting of nothing but a
 * "Full Changelog" compare link. The app renders the release body as the
 * post-upgrade changelog, so an empty body is a blank "what's new" for the
 * user. This script produces the notes the app can actually show.
 *
 * Usage:
 *   bun scripts/release-notes.ts [--tag v0.5.0-16] [--out release-notes.md]
 *                                [--repo owner/name] [--prev v0.5.0-15]
 *
 * Exit codes: 0 written (even when there is nothing to say), 1 on git failure.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

type Group = { heading: string; lines: string[] };

const TYPES: Record<string, string> = {
  feat: "New",
  fix: "Fixed",
  perf: "Improved",
  refactor: "Improved",
  revert: "Fixed",
  style: "Improved",
  docs: "Docs",
};

/** Commits that are noise in a user-facing changelog. */
const SKIP = new Set(["chore", "ci", "build", "test", "release"]);

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf("--" + name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]!;
  return fallback;
}

const tag = arg("tag", process.env.GITHUB_REF_NAME ?? "");
const out = arg("out", "release-notes.md");
const repo = arg("repo", process.env.GITHUB_REPOSITORY ?? "");
if (!tag) {
  console.error("release-notes: no tag (pass --tag or set GITHUB_REF_NAME)");
  process.exit(1);
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function previousTag(explicit: string): string | null {
  if (explicit) return explicit;
  const series = /^v?([0-9]+[.][0-9]+)[.]/.exec(tag)?.[1];
  for (const pattern of series ? ["v" + series + ".*", "v*"] : ["v*"]) {
    try { return git("describe", "--tags", "--abbrev=0", "--match", pattern, tag + "^") || null; }
    catch { /* A first tag in this release line may have only an older ancestor. */ }
  }
  return null;
}

const prev = previousTag(arg("prev", ""));
const range = prev ? prev + ".." + tag : tag;

let subjects: string[] = [];
try {
  subjects = git("log", "--no-merges", "--pretty=format:%s", range)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch (error) {
  console.error("release-notes: git log failed for " + range + ": " + String(error));
  process.exit(1);
}

const groups = new Map<string, Group>();
const add = (heading: string, line: string) => {
  const group = groups.get(heading) ?? { heading, lines: [] };
  group.lines.push(line);
  groups.set(heading, group);
};

/** "feat(desktop): configurable data dir" → ["feat", "desktop", "configurable data dir"] */
function splitSubject(subject: string): { type: string; scope: string; text: string } | null {
  const match = /^([a-z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(subject);
  if (!match) return null;
  return { type: match[1]!, scope: match[2] ?? "", text: match[3]!.trim() };
}

for (const subject of subjects) {
  const parsed = splitSubject(subject);
  if (!parsed) {
    add("Other", "- " + subject);
    continue;
  }
  if (SKIP.has(parsed.type)) continue;
  const heading = TYPES[parsed.type] ?? "Other";
  const lead = parsed.scope ? "**" + parsed.scope + "**: " : "";
  const text = parsed.text.charAt(0).toUpperCase() + parsed.text.slice(1);
  add(heading, "- " + lead + text);
}

const ORDER = ["New", "Improved", "Fixed", "Docs", "Other"];
const sections: string[] = [];
for (const heading of ORDER) {
  const group = groups.get(heading);
  if (!group || group.lines.length === 0) continue;
  sections.push("## " + heading + "\n\n" + group.lines.join("\n"));
}
if (sections.length === 0) {
  sections.push("## New\n\n- Maintenance release; no user-facing changes.");
}

let body = sections.join("\n\n");
if (prev && repo) {
  body += "\n\n**Full Changelog**: https://github.com/" + repo + "/compare/" + prev + "..." + tag;
}
body += "\n";

writeFileSync(out, body, "utf8");
console.log("release-notes: wrote " + out + " from " + range + " (" + subjects.length + " commits)");
