import {
  ArrowLeft,
  ArrowRight,
  CaretDoubleLeft,
  CaretDoubleRight,
} from "@phosphor-icons/react";
import { IconButton, Tooltip } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import type { ReaderNavigationApi } from "../hooks/useReaderNavigation";
export function ReaderNavigationControls({
  navigation,
}: {
  navigation: ReaderNavigationApi;
}) {
  const { t } = useTranslation("reader");
  return (
    <div className="pointer-events-auto flex items-center gap-0.5">
      <Tooltip content={t("navigation.back")}>
        <IconButton
          size="sm"
          label={t("navigation.back")}
          disabled={navigation.busy || !navigation.canBack}
          onClick={() => void navigation.step(-1)}
          icon={<ArrowLeft size={16} />}
        />
      </Tooltip>
      <Tooltip content={t("navigation.forward")}>
        <IconButton
          size="sm"
          label={t("navigation.forward")}
          disabled={navigation.busy || !navigation.canForward}
          onClick={() => void navigation.step(1)}
          icon={<ArrowRight size={16} />}
        />
      </Tooltip>
      <div className="hidden items-center md:flex">
        <Tooltip content={t("navigation.previousChapter")}>
          <IconButton
            size="sm"
            label={t("navigation.previousChapter")}
            disabled={!navigation.previous || navigation.busy}
            onClick={() => navigation.chapter(-1)}
            icon={<CaretDoubleLeft size={16} />}
          />
        </Tooltip>
        <Tooltip content={t("navigation.nextChapter")}>
          <IconButton
            size="sm"
            label={t("navigation.nextChapter")}
            disabled={!navigation.next || navigation.busy}
            onClick={() => navigation.chapter(1)}
            icon={<CaretDoubleRight size={16} />}
          />
        </Tooltip>
      </div>
      {navigation.error && (
        <span role="alert" className="max-w-32 text-xs text-fg-muted">
          {navigation.error}
        </span>
      )}
    </div>
  );
}
