import { Caption, Heading, Progress, Select } from "@read-aware/ui";
import { useTranslation } from "../../../i18n";
import { useReadingGoal } from "../hooks/useReadingGoal";
export function ReadingGoalCard() {
  const { t } = useTranslation("stats"),
    goal = useReadingGoal();
  return (
    <section className="mb-8 flex flex-col gap-3 border-b border-border pb-6">
      <Heading size="xl">{t("goal.title")}</Heading>
      <Select
        label={t("goal.target")}
        value={String(goal.targetMinutes)}
        options={[0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map((n) => ({
          value: String(n),
          label: n === 0 ? t("goal.off") : t("goal.minutes", { count: n }),
        }))}
        onChange={(value) => goal.setTarget(Number(value))}
      />
      {goal.targetMinutes > 0 && (
        <>
          <Progress value={goal.fraction * 100} label={t("goal.title")} />
          <Caption aria-live="polite">
            {goal.achieved
              ? t("goal.achieved")
              : t("goal.remaining", { count: goal.remainingMinutes })}{" "}
            · {t("goal.read", { count: Math.floor(goal.readMinutes) })}
          </Caption>
        </>
      )}
    </section>
  );
}
