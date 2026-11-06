import { normalizeTextEncoding, type TextEncoding } from "../lib/decode-text";
import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  readerOverridesAtom,
  readerPreferencesAtom,
  resolvedAppThemeAtom,
} from "../../../state/ui";
import {
  toEffectiveReaderSettings,
  type ReaderSettings,
  type ReaderSettingsPreferences,
} from "../../settings/lib/reader-settings";
import type { ReaderAppearanceScope } from "../../settings/lib/reader-overrides";

export type { ReaderAppearanceScope };

type UseReaderAppearanceResult = {
  /** Where edits land: `global` (all inheriting books) or `book` (this book). */
  scope: ReaderAppearanceScope;
  /** The preferences the controls bind to — global prefs or the book override. */
  prefs: ReaderSettingsPreferences;
  /** Render-ready settings for this book, with `auto` page color resolved. */
  effective: ReaderSettings;
  textEncoding: TextEncoding;
  setTextEncoding: (encoding: TextEncoding) => void;
  setScope: (scope: ReaderAppearanceScope) => void;
  updatePrefs: (prefs: ReaderSettingsPreferences) => void;
};

/**
 * Resolves the appearance a given book reads with and routes edits to the right
 * place. In `global` scope the controls reflect (and mutate) the shared global
 * preferences; in `book` scope they reflect (and mutate) that book's override.
 * Both the reader surface and the appearance popover call this with the same
 * book id, so they stay in sync through the shared atoms.
 */
export function useReaderAppearance(bookId: string): UseReaderAppearanceResult {
  const [globalPrefs, setGlobalPrefs] = useAtom(readerPreferencesAtom);
  const [overrides, setOverrides] = useAtom(readerOverridesAtom);
  const appTheme = useAtomValue(resolvedAppThemeAtom);

  const override = overrides[bookId];
  const scope: ReaderAppearanceScope =
    override?.scope === "book" ? "book" : "global";
  const prefs = scope === "book" && override ? override.settings : globalPrefs;
  // Keep a stable reference so consumers that key effects on the settings object
  // (e.g. the reader re-injecting CSS) only react to genuine changes, not to
  // every render — a fresh object each render would reset reader scroll position.
  const effective = useMemo(
    () => toEffectiveReaderSettings(prefs, appTheme),
    [prefs, appTheme],
  );

  const setScope = useCallback(
    (next: ReaderAppearanceScope) => {
      setOverrides((current) => {
        const existing = current[bookId];
        if (next === "global" && !existing) return current;
        // Keep the snapshot and independent decoder/TTS fields from the
        // latest state, including writes batched before this scope change.
        return {
          ...current,
          [bookId]: {
            ...existing,
            settings: existing?.settings ?? globalPrefs,
            scope: next,
          },
        };
      });
    },
    [bookId, globalPrefs, setOverrides],
  );

  const updatePrefs = useCallback(
    (next: ReaderSettingsPreferences) => {
      if (scope === "book") {
        setOverrides((current) => ({
          ...current,
          [bookId]: { ...current[bookId], scope: "book", settings: next },
        }));
        return;
      }
      setGlobalPrefs(next);
    },
    [bookId, scope, setGlobalPrefs, setOverrides],
  );

  const setTextEncoding = useCallback(
    (textEncoding: TextEncoding) =>
      setOverrides((current) => ({
        ...current,
        [bookId]: {
          ...current[bookId],
          scope: current[bookId]?.scope ?? "global",
          settings: current[bookId]?.settings ?? globalPrefs,
          textEncoding,
        },
      })),
    [bookId, globalPrefs, setOverrides],
  );
  return {
    scope,
    prefs,
    effective,
    setScope,
    updatePrefs,
    textEncoding: normalizeTextEncoding(override?.textEncoding),
    setTextEncoding,
  };
}
