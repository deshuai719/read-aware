import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdvancedReaderFields } from "./AdvancedReaderFields";
import { DEFAULT_READER_PREFERENCES } from "../lib/reader-settings";
const meta = {
  title: "Interface/Settings/Advanced reader fields",
  component: AdvancedReaderFields,
  args: { value: DEFAULT_READER_PREFERENCES, onChange: () => {} },
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdvancedReaderFields>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Reflowable: Story = {};
export const FixedLayout: Story = { args: { fixedLayout: true } };
