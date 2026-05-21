import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "../components/ui/input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter amount"
  }
};

export const WithValue: Story = {
  args: {
    defaultValue: "250.00",
    "aria-label": "Stake amount"
  }
};

export const Invalid: Story = {
  args: {
    defaultValue: "0",
    "aria-invalid": true,
    "aria-label": "Invalid amount"
  }
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Disabled"
  }
};
