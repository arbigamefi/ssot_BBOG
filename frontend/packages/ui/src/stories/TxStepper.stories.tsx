import type { Meta, StoryObj } from "@storybook/react";

import { TxStepper } from "../components/protocol/tx-stepper";
import type { TxStepItem } from "../components/protocol/tx-stepper";

const meta: Meta<typeof TxStepper> = {
  title: "System/TxStepper",
  component: TxStepper,
};

export default meta;
type Story = StoryObj<typeof TxStepper>;

function steps(state: "idle" | "planning" | "needs" | "submitting" | "mined" | "failed"): TxStepItem[] {
  const approve: TxStepItem = { title: "Approve", description: "Authorize Bank to transfer stake", state: "todo" };
  const place: TxStepItem = { title: "Place bet", description: "Hub.placeBet (payable)", state: "todo" };
  if (state === "planning") {
    approve.state = "active";
  }
  if (state === "needs") {
    approve.state = "active";
  }
  if (state === "submitting") {
    approve.state = "done";
    place.state = "active";
  }
  if (state === "mined") {
    approve.state = "done";
    place.state = "done";
  }
  if (state === "failed") {
    approve.state = "done";
    place.state = "error";
  }
  return [approve, place];
}

export const Idle: Story = {
  args: {
    title: "Transaction",
    subtitle: "Plan → Stepper → Receipt",
    steps: steps("idle"),
  },
};

export const Planning: Story = {
  args: {
    title: "Transaction",
    subtitle: "Planning",
    steps: steps("planning"),
  },
};

export const NeedsApproval: Story = {
  args: {
    title: "Transaction",
    subtitle: "Approval required",
    steps: steps("needs"),
  },
};

export const Submitting: Story = {
  args: {
    title: "Transaction",
    subtitle: "Submitting",
    steps: steps("submitting"),
  },
};

export const Mined: Story = {
  args: {
    title: "Transaction",
    subtitle: "Mined",
    steps: steps("mined"),
  },
};

export const Failed: Story = {
  args: {
    title: "Transaction",
    subtitle: "Failed",
    steps: steps("failed"),
  },
};
