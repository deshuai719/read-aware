import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../../i18n";
import { getGeneralSettings } from "../../settings/lib/general-settings";
import { fetchWhatsNewEntry, type WhatsNewEntry } from "../lib/changelog-feed";
import { fetchReleaseNotes } from "../lib/release-notes";
import { bundledReleaseNotes } from "../lib/bundled-release-notes";
import { readCurrentAppVersion } from "../lib/software-update";
import { dismissWhatsNew, reconcileWhatsNew } from "../lib/whats-new";
import { versionCodename } from "../lib/version-codename";

/**
 * The post-upgrade "what's new" dialog: raised once per version change (same
 * reconcile/TTL state machine the old header chip used — see lib/whats-new).
 * The dialog opens IMMEDIATELY with a loading body — the changelog entry is
 * fetched on the fly from the landing site (lib/changelog-feed) and fills in
 * when it lands (stable releases); a version the site doesn't curate falls
 * back to its GitHub release body (see lib/release-notes), and only a release
 * with no notes at all shows the one-line fallback.
 * A bounded timeout caps the wait, so the skeleton can never hang; closing
 * the dialog — any button, Escape, the backdrop — dismisses the notice for
 * good. When the user turned the dialog off in Settings the notice is
 * consumed silently instead, so a later re-enable never pops a stale
 * version.
 */
export function useWhatsNewDialog(): {
  version: string | null;
  codename: string | null;
  entry: WhatsNewEntry | null;
  loading: boolean;
  close: () => void;
} {
  const locale = useLocale();
  const [state, setState] = useState<{
    version: string;
    entry: WhatsNewEntry | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readCurrentAppVersion()
      .then(async (current) => {
        if (cancelled || !current) return;
        const notice = reconcileWhatsNew(current);
        if (!notice) return;
        if (!getGeneralSettings().whatsNewDialog) {
          dismissWhatsNew();
          return;
        }
        // Open first, load after — the dialog must never wait on the network.
        setState({ version: notice.version, entry: null, loading: true });
        // Two sources, richest first: the site's curated registry (stable
        // releases, translated) and then the GitHub release body for this
        // exact tag (what this fork publishes — scripts/release-notes.ts
        // writes it from the commit log). A body-less release falls through
        // to the dialog's one-line fallback.
        const local = bundledReleaseNotes(notice.version, locale);
        const curated = local ? null : await fetchWhatsNewEntry(notice.version, locale);
        const entry = local ?? curated ?? (await fetchReleaseNotes(notice.version));
        if (cancelled) return;
        setState({ version: notice.version, entry, loading: false });
      })
      .catch(() => {
        // A failed version read means no Tauri (browser dev) — nothing to do.
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const close = useCallback(() => {
    dismissWhatsNew();
    setState(null);
  }, []);

  const codename = state
    ? (state.entry?.codename ?? versionCodename(state.version))
    : null;
  return {
    version: state?.version ?? null,
    codename,
    entry: state?.entry ?? null,
    loading: state?.loading ?? false,
    close,
  };
}
