import { importCoverImage } from "../../../platform/import-cover-image";
import { useRef, useState } from "react";
import { Button, Dialog, TextArea } from "@read-aware/ui";
import { cn } from "@read-aware/ui/cn";
import { useTranslation } from "../../../i18n";
import type { CollectionTileData } from "./CollectionTile";

type MemberCover = { id: string; title: string; coverUrl?: string | null };

type CollectionProfileDialogProps = {
  collection: CollectionTileData;
  /** Member books, for the "use this cover" chooser. */
  members: MemberCover[];
  description: string;
  coverBookId: string | null;
  coverDataUrl?: string | null;
  onClose: () => void;
  onSave: (patch: { description: string; coverBookId: string | null; coverDataUrl: string | null }) => void;
};

/**
 * Edit a collection's presentation: a short description and the one cover that
 * stands for the folder. The cover is chosen from the collection's own books —
 * "automatic" keeps the 2×2 montage, which is what a folder of covers should
 * look like until the user says otherwise.
 */
export function CollectionProfileDialog({
  collection,
  members,
  description,
  coverBookId,
  coverDataUrl = null,
  onClose,
  onSave,
}: CollectionProfileDialogProps) {
  const { t } = useTranslation("shelf");
  const [text, setText] = useState(description);
  const [cover, setCover] = useState<string | null>(coverBookId);
  const [customCover, setCustomCover] = useState<string | null>(coverDataUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const chooseImage = async (file: File) => {
    setLoading(true); setError(null);
    try { setCustomCover(await importCoverImage(file)); setCover(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  };
  const withCovers = members.filter((member) => Boolean(member.coverUrl));

  return (
    <Dialog open onClose={onClose} title={t("collection.profileTitle", { name: collection.name })}>
      <div className="space-y-5">
        <TextArea
          label={t("collection.descriptionLabel")}
          value={text}
          rows={3}
          placeholder={t("collection.descriptionPlaceholder")}
          onChange={(event) => setText(event.target.value)}
        />

        <div className="space-y-2">
          <p className="font-sans text-[13px] font-medium text-fg-muted">
            {t("collection.coverLabel")}
          </p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImage(file); event.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>
            {t("collection.coverUpload")}
          </Button>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {customCover && <img src={customCover} alt={t("collection.coverLabel")} className="h-24 w-16 rounded-sm border border-fg object-cover" />}
            <button
              type="button"
              onClick={() => { setCover(null); setCustomCover(null); }}
              className={cn(
                "flex h-24 w-16 items-center justify-center rounded-sm border text-center font-sans text-[11px] leading-tight text-fg-muted",
                cover === null && !customCover ? "border-fg ring-1 ring-fg" : "border-border hover:border-fg-subtle",
              )}
            >
              {t("collection.coverAuto")}
            </button>
            {withCovers.map((member) => (
              <button
                key={member.id}
                type="button"
                title={member.title}
                onClick={() => { setCover(member.id); setCustomCover(null); }}
                className={cn(
                  "h-24 w-16 overflow-hidden rounded-sm border",
                  cover === member.id ? "border-fg ring-1 ring-fg" : "border-border hover:border-fg-subtle",
                )}
              >
                <img
                  src={member.coverUrl ?? ""}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          {withCovers.length === 0 && (
            <p className="font-sans text-xs text-fg-subtle">{t("collection.coverNone")}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => onSave({ description: text, coverBookId: cover, coverDataUrl: customCover })}
          >
            {t("collection.saveProfile")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
