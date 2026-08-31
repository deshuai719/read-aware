import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { DropdownMenu } from "./DropdownMenu";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

const meta = {
  title: "Design System/Components/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleItems = [
  { label: "Edit", onClick: () => {} },
  { label: "Duplicate", onClick: () => {} },
  { label: "Archive", onClick: () => {} },
  { label: "Delete", onClick: () => {}, destructive: true },
];

export const Default: Story = {
  args: {
    trigger: <Button variant="outline" size="sm">Actions</Button>,
    items: sampleItems,
  },
};

export const RightAligned: Story = {
  render: (args) => (
    <div className="flex justify-end">
      <DropdownMenu {...args} />
    </div>
  ),
  args: {
    trigger: <Button variant="outline" size="sm">Actions</Button>,
    items: sampleItems,
    align: "right",
  },
};

const MoreIcon = <DotsThreeVertical size={16} weight="bold" />;

export const WithIconTrigger: Story = {
  args: {
    trigger: <IconButton icon={MoreIcon} label="More actions" />,
    items: [
      { label: "Share", onClick: () => {} },
      { label: "Export", onClick: () => {} },
      { label: "Print", onClick: () => {}, disabled: true },
    ],
  },
};

export const OpensUpward: Story = {
  render: (args) => (
    <div className="flex min-h-72 items-end justify-center">
      <DropdownMenu {...args} />
    </div>
  ),
  args: {
    trigger: <IconButton icon={MoreIcon} label="More actions" />,
    items: sampleItems,
    side: "top",
  },
};

/**
 * Context-menu mode: a fully controlled menu anchored to fixed viewport
 * coordinates. Right-click anywhere in the dashed area; the panel flips above
 * the pointer near the bottom edge and shifts left near the right edge.
 */
export const Positioned: Story = {
  args: { items: sampleItems },
  render: () => {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    return (
      <div
        className="flex h-80 w-full cursor-pointer select-none items-center justify-center rounded-md border border-dashed border-border text-sm text-fg-muted"
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        Right-click here to open a context menu
        {menu && (
          <DropdownMenu
            open
            onOpenChange={(open) => {
              if (!open) setMenu(null);
            }}
            position={menu}
            items={sampleItems}
          />
        )}
      </div>
    );
  },
};
