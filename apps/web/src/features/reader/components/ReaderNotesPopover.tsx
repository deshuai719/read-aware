import { useState } from "react";
import { Notebook } from "@phosphor-icons/react";
import {
  Body,
  Button,
  Checkbox,
  Dialog,
  Eyebrow,
  Popover,
  Select,
  TextField,
} from "@read-aware/ui";
import { cn } from "@read-aware/ui/cn";
import { formatNumber, useTranslation } from "../../../i18n";
import { AnnotationRow } from "../../annotations/components/AnnotationRow";
import type { Annotation } from "../../annotations/lib/annotation-types";
import { useAnnotationManagement } from "../../annotations/hooks/useAnnotationManagement";
import type {
  AnnotationType,
  Highlight,
} from "../../annotations/lib/annotation-types";
import type { TocEntry } from "../lib/reader-types";

type ReaderNotesPopoverProps = {
  annotations: Annotation[];
  bookId?: string;
  bookTitle?: string;
  tocEntries: TocEntry[];
  onNavigate: (cfiRange: string) => void;
  onDelete: (id: string) => void;
  /** 受控开合（导航条的面板意图需要外部打开）；不传则保持自管状态。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Mirrors the header icon buttons so the trigger sits flush with them.
const TRIGGER_CLASS =
  "h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg";

/**
 * The book's highlights and notes, opened from a header icon. Grouped by chapter
 * (in reading order); selecting one navigates to it and closes the popover.
 * Lives in the header so the right-hand panel can stay dedicated to chat.
 */
export function ReaderNotesPopover({
  annotations,
  bookId,
  bookTitle = "Annotations",
  tocEntries,
  onNavigate,
  onDelete,
  open: controlledOpen,
  onOpenChange,
}: ReaderNotesPopoverProps) {
  const { t } = useTranslation("reader");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const manage = useAnnotationManagement(
    bookId,
    bookTitle,
    annotations,
    tocEntries,
  );
  const groups = manage.groups;
  const colorOptions = ["yellow", "green", "blue", "pink"].map((value) => ({
    value,
    label: t(`colors.${value}` as "colors.yellow"),
  }));

  return (
    <>
      <Dialog
        open={manage.confirmRemove}
        onClose={() => {
          if (!manage.busy) manage.setConfirmRemove(false);
        }}
        title={t("annotationTools.confirmRemove")}
      >
        <Body className="text-sm">
          {t("annotationTools.removeSelected", { count: manage.selected.size })}
        </Body>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={manage.busy}
            onClick={() => manage.setConfirmRemove(false)}
          >
            {t("annotationTools.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={manage.busy}
            onClick={() => void manage.remove()}
          >
            {t("annotationTools.delete")}
          </Button>
        </div>
        {manage.error && <Body role="alert">{manage.error}</Body>}
      </Dialog>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="left"
        className="pointer-events-auto"
        triggerLabel={t("notes")}
        triggerTooltip={t("notes")}
        triggerClassName={cn(TRIGGER_CLASS, open && "text-fg")}
        trigger={
          <Notebook
            size={18}
            weight={open ? "bold" : "regular"}
            aria-hidden="true"
          />
        }
        panelClassName="flex max-h-[min(28rem,70vh)] w-[clamp(18rem,28vw,26rem)] flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <Eyebrow as="span">{t("notes")}</Eyebrow>
          <span className="text-xs tabular-nums text-fg-subtle">
            {formatNumber(annotations.length)}
          </span>
        </div>

        <div className="space-y-2 border-b border-border px-3 py-2">
          <TextField
            label={t("annotationTools.search")}
            value={manage.filter.query ?? ""}
            onChange={(e) =>
              manage.setFilter((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t("annotationTools.type")}
              value={manage.filter.type ?? "all"}
              options={[
                { value: "all", label: t("annotationTools.all") },
                ...(["highlight", "note", "ask"] as const).map((value) => ({
                  value,
                  label: t(
                    ("annotationTools." + value) as "annotationTools.highlight",
                  ),
                })),
              ]}
              onChange={(value) =>
                manage.setFilter((current) => ({
                  ...current,
                  type: value as AnnotationType | "all",
                }))
              }
            />
            <Select
              label={t("annotationTools.color")}
              value={manage.filter.color ?? "all"}
              options={[
                { value: "all", label: t("annotationTools.all") },
                ...colorOptions,
              ]}
              onChange={(value) =>
                manage.setFilter((current) => ({
                  ...current,
                  color: value as Highlight["color"] | "all",
                }))
              }
            />
          </div>
          <Select
            label={t("annotationTools.chapter")}
            value={manage.filter.chapter ?? ""}
            options={[
              { value: "", label: t("annotationTools.all") },
              ...tocEntries.map((entry) => ({
                value: entry.href,
                label: entry.label,
              })),
            ]}
            onChange={(value) =>
              manage.setFilter((current) => ({ ...current, chapter: value }))
            }
          />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={manage.busy}
              onClick={manage.selectVisible}
            >
              {t("annotationTools.selectVisible")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={manage.busy}
              onClick={manage.clear}
            >
              {t("annotationTools.clear")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={manage.busy || manage.filtered.length === 0}
              onClick={() => void manage.export("md")}
            >
              Markdown
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={manage.busy || manage.filtered.length === 0}
              onClick={() => void manage.export("csv")}
            >
              CSV
            </Button>
          </div>
          {manage.selected.size > 0 && (
            <div className="flex items-end gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={!bookId || manage.busy}
                onClick={() => manage.setConfirmRemove(true)}
              >
                {t("annotationTools.removeSelected", {
                  count: manage.selected.size,
                })}
              </Button>
              <Select
                label={t("annotationTools.recolor")}
                value=""
                options={colorOptions}
                placeholder={t("annotationTools.color")}
                disabled={!bookId || manage.busy || !manage.canRecolor}
                onChange={(value) =>
                  void manage.recolor(value as Highlight["color"])
                }
              />
            </div>
          )}
          {manage.error && (
            <Body role="alert" className="text-sm">
              {manage.error}
            </Body>
          )}
        </div>
        {manage.filtered.length === 0 ? (
          <div className="px-4 py-8">
            <Body className="text-center text-sm text-fg-muted">
              {t(
                annotations.length ? "annotationTools.noMatches" : "emptyNotes",
              )}
            </Body>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 px-3 py-3">
              {groups.map((group, index) => (
                <div key={group.label ?? `__rest__${index}`}>
                  {group.label && (
                    <p className="mb-1 px-2 font-sans text-[13px] font-medium text-fg-subtle">
                      {group.label}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {group.items.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="flex items-start gap-1"
                      >
                        <Checkbox
                          label={t("annotationTools.select")}
                          checked={manage.selected.has(annotation.id)}
                          disabled={manage.busy}
                          onChange={() => manage.toggle(annotation.id)}
                          className="mt-2 [&_label]:sr-only"
                        />
                        <AnnotationRow
                          annotation={annotation}
                          onNavigate={(cfiRange) => {
                            onNavigate(cfiRange);
                            setOpen(false);
                          }}
                          onDelete={onDelete}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Popover>
    </>
  );
}
