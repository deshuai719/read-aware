import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReaderTranslationDialog } from "./ReaderTranslationDialog";
const meta = {
  title: "Interface/Reader/TranslationDialog",
  component: ReaderTranslationDialog,
  args: {
    translation: {
      open: true,
      text: "An original selected passage, sent only to the configured model.",
      language: "zh-Hans",
      result: "用于界面验收的合成译文。",
      busy: false,
      error: null,
      translate: async () => {},
      cancel: () => {},
      close: () => {},
      setLanguage: () => {},
    },
  },
} satisfies Meta<typeof ReaderTranslationDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Streaming: Story = {
  args: {
    translation: {
      ...meta.args.translation,
      busy: true,
      result: "Streaming synthetic response…",
    },
  },
};
export const RetryableError: Story = {
  args: {
    translation: {
      ...meta.args.translation,
      error: "Translation failed. Try again.",
      result: "",
    },
  },
};
