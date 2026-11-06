import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReaderNavigationControls } from "./ReaderNavigationControls";
const entry = {
  id: "one",
  label: "Chapter one",
  href: "one.xhtml",
  depth: 0,
  spineIndex: 0,
};
const meta = {
  title: "Interface/Reader/NavigationControls",
  component: ReaderNavigationControls,
  args: {
    navigation: {
      canBack: true,
      canForward: false,
      busy: false,
      error: null,
      step: async () => {},
      previous: entry,
      next: {
        ...entry,
        id: "two",
        label: "Chapter two",
        href: "two.xhtml",
        spineIndex: 1,
      },
      chapter: () => {},
    },
  },
} satisfies Meta<typeof ReaderNavigationControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Busy: Story = {
  args: { navigation: { ...meta.args.navigation, busy: true } },
};
export const Error: Story = {
  args: {
    navigation: {
      ...meta.args.navigation,
      error: "Navigation failed. Try again.",
    },
  },
};
