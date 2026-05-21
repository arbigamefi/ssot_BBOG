import type { Meta, StoryObj } from "@storybook/react";

import { StatCard } from "../components/ui/stat-card";

const meta: Meta<typeof StatCard> = {
  title: "UI/StatCard",
  component: StatCard,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    label: "Bankroll",
    value: "25,000",
    subValue: "USDC",
    trend: "neutral"
  }
};

export const Set: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-3">
      <StatCard label="Volume" value="142.5K" subValue="+12%" trend="up" />
      <StatCard label="Open risk" value="8.2K" subValue="USDC" trend="neutral" />
      <StatCard label="Rejected" value="3" subValue="-1" trend="down" />
    </div>
  )
};
