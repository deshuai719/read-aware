import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReadingGoalCard } from "./ReadingGoalCard";
import { readingStatsAtom } from "../../../state/ui";
import { seed, withAtoms } from "../../../story-support/atoms";
const meta = {
  title: "Interface/Stats/ReadingGoalCard",
  component: ReadingGoalCard,
  decorators: [withAtoms(seed(readingStatsAtom, {}))],
} satisfies Meta<typeof ReadingGoalCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoRecordedTime: Story = {};
