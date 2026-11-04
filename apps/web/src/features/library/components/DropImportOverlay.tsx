import { Body } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";

/**
 * Full-window hint shown while book files hover over the app. When the drop
 * would land in a collection, the hint names it — the destination is part of
 * the gesture, so it must be visible before the release.
 * pointer-events-none keeps the drag events flowing to the window listeners
 * in useDropBookImport — the overlay only announces, it never intercepts.
 */
export function DropImportOverlay({ target }: { target?: string | null }) {
  const { t } = useTranslation("shelf");
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-paper/80">
      <div className="rounded-lg border-2 border-dashed border-stone-400 bg-paper px-10 py-8 text-center">
        <Body className="text-stone-600">
          {target ? t("dropImport.intoCollection", { collection: target }) : t("dropImport.hint")}
        </Body>
      </div>
    </div>
  );
}
