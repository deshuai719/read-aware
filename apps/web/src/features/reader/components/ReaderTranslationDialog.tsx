import { Body, Button, Caption, Dialog, Select, Spinner } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import type { useReaderTranslation } from "../hooks/useReaderTranslation";
import {
  TRANSLATION_LANGUAGES,
  type TranslationLanguage,
} from "../lib/translation";
const LABELS: Record<TranslationLanguage, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ru: "Русский",
};
export function ReaderTranslationDialog({
  translation,
}: {
  translation: ReturnType<typeof useReaderTranslation>;
}) {
  const { t } = useTranslation("reader");
  return (
    <Dialog
      open={translation.open}
      onClose={translation.close}
      title={t("translation.title")}
      className="w-[min(42rem,92vw)]"
    >
      <div className="flex max-h-[75vh] flex-col gap-4">
        <Select
          label={t("translation.language")}
          value={translation.language}
          options={TRANSLATION_LANGUAGES.map((value) => ({
            value,
            label: LABELS[value],
          }))}
          onChange={(value) =>
            translation.setLanguage(value as TranslationLanguage)
          }
        />
        <Caption>{t("translation.source")}</Caption>
        <Body className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm">
          {translation.text}
        </Body>
        <Caption>{t("translation.result")}</Caption>
        <Body
          className="max-h-80 overflow-y-auto whitespace-pre-wrap"
          aria-live="polite"
        >
          {translation.result}
        </Body>
        {translation.busy && <Spinner size="sm" />}
        {translation.error && <Body role="alert">{translation.error}</Body>}
        <div className="flex justify-end gap-2">
          {translation.busy ? (
            <Button variant="ghost" onClick={translation.cancel}>
              {t("translation.cancel")}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => void translation.translate()}
            >
              {t("translation.retry")}
            </Button>
          )}
          <Button variant="ghost" onClick={translation.close}>
            {t("translation.close")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
