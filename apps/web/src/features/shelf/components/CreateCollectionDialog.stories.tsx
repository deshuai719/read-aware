import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
const meta = {
  title: "Interface/Shelf/CreateCollectionDialog",
  component: CreateCollectionDialog,
  args: {
    open: true,
    onClose: () => {},
    onCreate: async (name) => ({
      id: "story-collection",
      name,
      createdAt: new Date().toISOString(),
    }),
  },
} satisfies Meta<typeof CreateCollectionDialog>;
export default meta;
type Story = StoryObj<typeof CreateCollectionDialog>;
export const Default: Story = {};
export const RetryableFailure: Story = { args: { onCreate: async () => null } };
