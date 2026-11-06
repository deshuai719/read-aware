import { Caption, ChoiceGroup, Select, Checkbox } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import type { ReaderSettingsPreferences } from "../lib/reader-settings";
import { normalizeReaderAdvanced } from "../lib/reader-advanced";
export function AdvancedReaderFields({
  value,
  onChange,
  fixedLayout = false,
}: {
  value: ReaderSettingsPreferences;
  onChange: (settings: ReaderSettingsPreferences) => void;
  fixedLayout?: boolean;
}) {
  const { t } = useTranslation("reader"),
    advanced = normalizeReaderAdvanced(value);
  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup
        label={t("advanced.transition")}
        value={advanced.pageTransition}
        options={[
          { value: "none" as const, label: t("advanced.none") },
          { value: "smooth" as const, label: t("advanced.smooth") },
        ]}
        onChange={(pageTransition) => onChange({ ...value, pageTransition })}
      />
      <Caption>{t("advanced.motionHint")}</Caption>
      {!fixedLayout && (
        <>
          <ChoiceGroup
            label={t("advanced.cjkLineBreak")}
            value={advanced.cjkLineBreak}
            options={[
              { value: "book" as const, label: t("advanced.book") },
              { value: "strict" as const, label: t("advanced.strict") },
              { value: "loose" as const, label: t("advanced.loose") },
            ]}
            onChange={(cjkLineBreak) => onChange({ ...value, cjkLineBreak })}
          />
          <Checkbox
            label={t("advanced.cjkSpacing")}
            checked={advanced.cjkSpacing}
            onChange={(event) =>
              onChange({ ...value, cjkSpacing: event.target.checked })
            }
          />
        </>
      )}
      <Select
        label={t("advanced.imageBrightness")}
        value={String(advanced.imageBrightness)}
        options={[100, 90, 80, 70, 50, 30].map((n) => ({
          value: String(n),
          label: n + "%",
        }))}
        onChange={(n) => onChange({ ...value, imageBrightness: Number(n) })}
      />
      <ChoiceGroup
        label={t("fixedLayoutColor")}
        value={value.fixedLayoutColor}
        options={[
          { value: "original" as const, label: t("advanced.original") },
          { value: "theme" as const, label: t("advanced.theme") },
        ]}
        onChange={(fixedLayoutColor) =>
          onChange({ ...value, fixedLayoutColor })
        }
      />
    </div>
  );
}
