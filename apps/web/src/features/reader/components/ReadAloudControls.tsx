import { Button, Caption, Popover, Select } from "@read-aware/ui";
import { SlidersHorizontal } from "@phosphor-icons/react";
import { useTranslation } from "../../../i18n";
import type { useReadAloud } from "../hooks/useReadAloud";
export function ReadAloudControls({
  player,
}: {
  player: ReturnType<typeof useReadAloud>;
}) {
  const { t } = useTranslation("reader"),
    { prefs, options, update } = player.settings;
  return (
    <Popover
      triggerLabel={t("readAloud.settings")}
      triggerTooltip={t("readAloud.settings")}
      trigger={<SlidersHorizontal size={15} aria-hidden="true" />}
      triggerClassName="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted"
      panelClassName="flex w-72 flex-col gap-4"
    >
      <Select
        label={t("readAloud.voice")}
        value={prefs.voice}
        options={options}
        onChange={(voice) => update({ ...prefs, voice })}
      />
      <Select
        label={t("readAloud.rate")}
        value={String(prefs.rate)}
        options={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => ({
          value: String(n),
          label: n + "×",
        }))}
        onChange={(value) => update({ ...prefs, rate: Number(value) })}
      />
      <Select
        label={t("readAloud.sleep")}
        value={String(prefs.sleepMinutes)}
        options={[0, 5, 10, 15, 30, 45, 60, 120].map((n) => ({
          value: String(n),
          label:
            n === 0
              ? t("readAloud.sleepOff")
              : t("readAloud.minutes", { count: n }),
        }))}
        onChange={(value) => update({ ...prefs, sleepMinutes: Number(value) })}
      />
      <Caption>{t("readAloud.perBook")}</Caption>
      {player.remaining !== null && (
        <Caption>
          {t("readAloud.remaining", { count: player.remaining })}
        </Caption>
      )}
      {player.playing && (
        <Button variant="ghost" size="sm" onClick={player.stop}>
          {t("readAloud.stop")}
        </Button>
      )}
    </Popover>
  );
}
