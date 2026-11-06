import type { Meta, StoryObj } from "@storybook/react-vite";
import { LibraryTextResult } from "./LibraryTextResult";
const meta = {
  title: "Interface/Library/Full-text result",
  component: LibraryTextResult,
  args: {
    hit: {
      bookId: "synthetic",
      bookTitle: "Synthetic book",
      sourceSha256: "hash",
      cfi: "epubcfi(/6/2)",
      chapter: "Chapter 2",
      pre: "A long paragraph that wraps to multiple lines. ",
      match: "quiet road",
      post: " continues through the valley, remaining entirely inside this result row.",
    },
    onSelect: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryTextResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WrappingRows: Story = {};
