import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";

const meta: Meta<typeof PageHeader> = {
  title: "UI/PageHeader",
  component: PageHeader,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Sportsbook",
    description: "Browse open markets, compare odds, and track tickets from one surface."
  }
};

export const WithActions: Story = {
  args: {
    title: "Portfolio",
    description: "Wallet positions, claimable rewards, and activity receipts.",
    actions: (
      <>
        <Button variant="secondary" size="sm">
          Export
        </Button>
        <Button size="sm">Deposit</Button>
      </>
    )
  }
};
