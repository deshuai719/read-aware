import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReadAloudControls } from "./ReadAloudControls";
const meta = {
  title: "Interface/Reader/ReadAloudControls",
  component: ReadAloudControls,
  args: {
    player: {
      available: true,
      playing: true,
      paused: false,
      remaining: 5,
      toggle: () => {},
      stop: () => {},
      pause: () => {},
      resume: () => {},
      settings: {
        prefs: { voice: "system", rate: 1.5, sleepMinutes: 5 },
        options: [
          { value: "auto", label: "Automatic" },
          { value: "system", label: "System voice" },
        ],
        update: () => {},
        pluginVoice: null,
        systemVoice: undefined,
      },
    },
  },
} satisfies Meta<typeof ReadAloudControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playing: Story = {};
export const Paused: Story = {
  args: { player: { ...meta.args.player, paused: true } },
};
export const SleepOff: Story = {
  args: {
    player: {
      ...meta.args.player,
      remaining: null,
      settings: {
        ...meta.args.player.settings,
        prefs: { voice: "system", rate: 1, sleepMinutes: 0 },
      },
    },
  },
};
