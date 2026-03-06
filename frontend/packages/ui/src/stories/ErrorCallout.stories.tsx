import type { Meta, StoryObj } from "@storybook/react";

import { ErrorCallout } from "../components/protocol/error-callout";

const meta: Meta<typeof ErrorCallout> = {
  title: "System/ErrorCallout",
  component: ErrorCallout,
};

export default meta;
type Story = StoryObj<typeof ErrorCallout>;

export const Default: Story = {
  args: {
    message: "Insufficient VRF fee. Please retry with a higher fee quote.",
  },
};

export const WithDetails: Story = {
  args: {
    title: "Transaction reverted",
    message: "Hub.placeBet reverted with a custom error.",
    details: "InsufficientVRFFee(required=123, actual=100)",
  },
};
