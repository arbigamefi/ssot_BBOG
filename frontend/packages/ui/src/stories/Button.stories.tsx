import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/ui/button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Continue" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};
