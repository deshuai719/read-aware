# Upstream 0.6 picks (evaluated 2026-11-03)

Local checkout: fork of [ahpxex/read-aware](https://github.com/ahpxex/read-aware),
branch `feat/data-dir-config`, product version `v0.5.0-16`.
Upstream `main` at evaluation time: `3e5b7309` (2026-10-30, after `v0.6.9`), **948 commits ahead**,
35 commits of fork-local work.

`git fetch --no-tags https://github.com/ahpxex/read-aware main` +
`git update-ref refs/tmp/upstream-main FETCH_HEAD` keeps the upstream tip addressable without
adding a remote. Re-run those two commands to refresh.

## Ported now (self-contained, verified with `bun run typecheck`)

| Upstream commit | What it fixes | Where it landed here |
| --- | --- | --- |
| `8aade62a` fix(ui): keep popovers inside the visible viewport vertically | A popover opened from a near-bottom trigger ran past the screen edge (landscape, phone bottom toolbars). | `packages/ui/src/Popover.tsx` — new `side` prop (`"auto"` default), measured `useVerticalPlacement`, cap applied to the flex wrapper so a caller's `max-h-*` still counts. `apps/web/src/index.css` gained `.ra-motion-overlay-pop-up` + keyframes + reduced-motion coverage. |
| `e0ee7baa` fix(ui): float choice and swatch legends to avoid WebKit flex gap | WebKit counted a rendered `<legend>`'s height twice when the fieldset was a flex item, so stacked ChoiceGroups grew ~27px per relayout in the Tauri app. | `packages/ui/src/ChoiceGroup.tsx` — floated full-width legend + `clear-both` on the option row. |
| `dfc80eb6` fix(reader): drop the eyebrow title bar from the footnote popover | A "FOOTNOTE" header ate vertical space and scrolled away with long notes; the close button scrolled out of reach. | `apps/web/src/features/reader/components/ReaderFootnotePopover.tsx` — header removed, close button floats outside the scroller, label kept as the dialog's accessible name. |
| `071e0927` fix(desktop): collect launch arguments as OsStr | `std::env::args` panics on non-Unicode argv, so a book with a lone-surrogate filename killed the app at cold start. | `apps/desktop/src-tauri/src/external_open.rs` (`AsRef<OsStr>`, flag detection on encoded bytes) + `src/lib.rs` call sites switched to `args_os()`. **Not compile-verified**: this machine has no MSVC `link.exe`. |

## Evaluated and deliberately skipped (with the reason)

| Upstream commit | Why not now |
| --- | --- |
| `5c02a90a` polyfill `AbortSignal.any` (+ ES2023/2024 built-ins) | Adds `apps/web/src/platform/polyfills.ts`, which does not exist here, and the local tree has **zero** call sites for `AbortSignal.any`, `Promise.withResolvers`, `Object.groupBy`, `toSorted`. Port it together with the 0.6 merge (or the first time we call one of those APIs), not before. |
| `b419d473` / `68f8e7ae` chat markdown fixes | They build on `features/ai/lib/markdown-fragment.ts` and `MarkdownLink.tsx`, neither of which exists in the v0.5 tree; the fix is a rewrite of the markdown pipeline, not a patch. |
| `8efa3a00` footnote popovers open again | Touches the vendored engine, which upstream **moved** (`apps/web/foliate-js` → build-time import); locally it is `apps/web/public/foliate-js`, script-injected. Re-vendor instead of hand-patching. |
| `81b6c899` inline glyph images on their text line | Valuable for CJK books, but it introduces `features/reader/lib/reader-document-layout.ts` + reader-CSS changes that can only be judged in a running reader. Port when the desktop build is unblocked. |
| `f3a503e4` draw a saved mark from its stored row | Depends on the 0.6 annotation read-model ("stored row"), which the v0.5 `storage/annotations.rs` does not expose. |
| `dd1f15ed` refactor(errors): unify error handling behind stable codes | Right direction, wrong granularity for a port: 12 files of the 0.6 storage layout. Adopt the *idea* (`error.rs`, stable machine codes + developer message) when the Rust tree is restructured, and in the meantime follow the rule recorded in `.trellis/spec/desktop/backend/index.md`. |
| `3e5b7309`, `f3a503e4`-adjacent plugin-context split, `dd1f15ed` storage pruning | 0.6-only module layout (148 `storage/` modules vs 10 here); merge upstream first. |

## Toolchain note (blocks any Rust verification)

```text
cargo 1.98.0, rustup stable-x86_64-pc-windows-msvc  -> installed
link.exe (MSVC)                                     -> MISSING
C:\Program Files (x86)\Microsoft Visual Studio      -> only "Installer", no VC++ workload
```

`rusqlite` is built with the `bundled` feature, so it needs `cl.exe` too. Until the workload is
installed, every Rust-side change here is review-only:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements ` +
  --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Next candidates, in the order worth doing

1. Rust tree merge (storage split, `error.rs`, checkpoints) — the single highest-value upstream change, and the one that decides how the fork's `data_dir.rs` / `single_instance_guard.rs` survive.
2. `5c02a90a` polyfills, landed with the merge.
3. `81b6c899` CJK inline-glyph layout, once the desktop app builds.
4. `dfc80eb6`/`8efa3a00`-class reader polish after re-vendoring foliate-js.
