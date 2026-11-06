import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReaderBookmarksPopover } from "./ReaderBookmarksPopover";
const meta = {
  title: "Interface/Reader/BookmarksPopover",
  component: ReaderBookmarksPopover,
  args: {
    book: {
      id: "bookmark-story",
      title: "Synthetic book",
      author: "QA",
      format: "epub",
      fileName: "story.epub",
      fileSize: 1,
      mimeType: "application/epub+zip",
      createdAt: "2026-11-06T00:00:00Z",
      updatedAt: "2026-11-06T00:00:00Z",
      lastOpenedAt: null,
      progress: null,
      progressPercent: 0,
      readingStatus: "unread",
      starred: false,
      collectionId: null,
    },
    cursor: {
      anchor: "epubcfi(/6/2!/4/2)",
      chapterTitle: "Chapter one",
      bookProgress: 0.2,
      visibleText: "Synthetic saved passage",
    },
    enabled: true,
    onNavigate: () => {},
  },
} satisfies Meta<typeof ReaderBookmarksPopover>;
export default meta;
type Story = StoryObj<typeof meta>;
/** UI-only fixture; persisted bookmarks are accepted in isolated Tauri. */
export const Empty: Story = {};
export const Disabled: Story = { args: { enabled: false, cursor: null } };
