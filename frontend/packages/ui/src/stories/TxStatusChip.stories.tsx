import type { Meta, StoryObj } from "@storybook/react";

import { TxStatusChip } from "../components/protocol/tx-status-chip";

const meta: Meta<typeof TxStatusChip> = {
  title: "System/TxStatusChip",
  component: TxStatusChip,
};

export default meta;
type Story = StoryObj<typeof TxStatusChip>;

export const Idle: Story = { args: { status: "idle" } };
export const Planning: Story = { args: { status: "planning" } };
export const Submitting: Story = { args: { status: "submitting" } };
export const Mined: Story = { args: { status: "mined" } };
export const Failed: Story = { args: { status: "failed" } };