import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { readerOverridesAtom, readerPreferencesAtom } from "../../../state/ui";
import { voiceProvidersAtom } from "../../plugins/state/plugin-store";
import {
  normalizeReadAloud,
  type ReadAloudPreferences,
} from "../lib/read-aloud-preferences";
import { resolvePluginText } from "../../plugins/lib/plugin-i18n";
import { useLocale, useTranslation } from "../../../i18n";
export function useReadAloudPreferences(bookId: string) {
  const [overrides, setOverrides] = useAtom(readerOverridesAtom),
    global = useAtomValue(readerPreferencesAtom),
    providers = useAtomValue(voiceProvidersAtom),
    [systemVoices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    locale = useLocale(),
    { t } = useTranslation("reader");
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const sync = () => setVoices(synth.getVoices());
    sync();
    synth.addEventListener?.("voiceschanged", sync);
    return () => synth.removeEventListener?.("voiceschanged", sync);
  }, []);
  const prefs = normalizeReadAloud(overrides[bookId]?.readAloud);
  const options = useMemo(
    () => [
      { value: "auto", label: t("readAloud.autoVoice") },
      { value: "system", label: t("readAloud.systemVoice") },
      ...systemVoices.map((voice) => ({
        value: "system:" + voice.voiceURI,
        label: voice.name + " · " + voice.lang,
      })),
      ...providers.flatMap((provider) =>
        provider.voices.map((voice) => ({
          value: "plugin:" + provider.key + ":" + voice.id,
          label:
            typeof voice.label === "string"
              ? voice.label
              : resolvePluginText(voice.label, locale),
        })),
      ),
    ],
    [providers, systemVoices, locale, t],
  );
  const update = useCallback(
    (readAloud: ReadAloudPreferences) =>
      setOverrides((current) => ({
        ...current,
        [bookId]: {
          ...current[bookId],
          scope: current[bookId]?.scope ?? "global",
          settings: current[bookId]?.settings ?? global,
          readAloud: normalizeReadAloud(readAloud),
        },
      })),
    [bookId, global, setOverrides],
  );
  const pluginVoice = prefs.voice.startsWith("system")
    ? null
    : prefs.voice === "auto"
      ? (providers.flatMap((provider) =>
          provider.voices
            .slice(0, 1)
            .map((voice) => ({ provider, voiceId: voice.id })),
        )[0] ?? null)
      : (providers
          .flatMap((provider) =>
            provider.voices.map((voice) => ({
              provider,
              voiceId: voice.id,
              key: "plugin:" + provider.key + ":" + voice.id,
            })),
          )
          .find((voice) => voice.key === prefs.voice) ?? null);
  const systemVoice = systemVoices.find(
    (voice) => "system:" + voice.voiceURI === prefs.voice,
  );
  return { prefs, update, options, pluginVoice, systemVoice };
}
