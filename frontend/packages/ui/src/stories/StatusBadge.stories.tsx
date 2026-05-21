import type { Meta, StoryObj } from "@storybook/react";

import { StatusBadge } from "../components/ui/status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "UI/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusBadge status="placed" />
      <StatusBadge status="pending" />
      <StatusBadge status="settled" />
      <StatusBadge status="won" />
      <StatusBadge status="lost" />
      <StatusBadge status="cancelled" />
      <StatusBadge status="failed" />
    </div>
  )
};
