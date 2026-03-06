import type { Meta, StoryObj } from "@storybook/react";
import { ReadOnlyBanner } from "../components/protocol/read-only-banner";

const meta: Meta<typeof ReadOnlyBanner> = {
  title: "System/ReadOnlyBanner",
  component: ReadOnlyBanner,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ReadOnlyBanner>;

export const Default: Story = {
  args: {
    reason: "Release snapshot is invalid or missing.",
    details: [
      "Hub address is zero",
      "Release digest is placeholder"
    ]
  }
};
