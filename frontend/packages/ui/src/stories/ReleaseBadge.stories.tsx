import type { Meta, StoryObj } from "@storybook/react";
import { ReleaseBadge } from "../components/protocol/release-badge";

const meta: Meta<typeof ReleaseBadge> = {
  title: "System/ReleaseBadge",
  component: ReleaseBadge,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ReleaseBadge>;

export const Example: Story = {
  args: {
    networkName: "Base Sepolia",
    hubShort: "0x12…bE",
    digestShort: "a1b2c3d4",
  },
};
