import type { Meta, StoryObj } from "@storybook/react-vite";
import { LibraryFullTextDialog } from "./LibraryFullTextDialog";
const meta = {
  title: "Interface/Library/FullTextDialog",
  component: LibraryFullTextDialog,
  args: { open: true, onClose: () => {}, books: [], onNavigate: () => {} },
} satisfies Meta<typeof LibraryFullTextDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Rendering/keyboard fixture only; real source scanning requires Tauri. */
export const Empty: Story = {};
