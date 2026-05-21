"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { TabBar } from "../components/ui/tab-bar";

const meta: Meta<typeof TabBar> = {
  title: "UI/TabBar",
  component: TabBar,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof TabBar>;

function TabBarDemo() {
  const [activeKey, setActiveKey] = React.useState("deposit");
  return (
    <TabBar
      activeKey={activeKey}
      onTabChange={setActiveKey}
      tabs={[
        { key: "deposit", label: "Deposit" },
        { key: "withdraw", label: "Withdraw" },
        { key: "claim", label: "Claim" },
        { key: "disabled", label: "Disabled", disabled: true }
      ]}
    />
  );
}

export const Default: Story = {
  render: () => <TabBarDemo />
};
