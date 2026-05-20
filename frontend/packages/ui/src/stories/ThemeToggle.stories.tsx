import type { Meta, StoryObj } from "@storybook/react";
import { ThemeToggle } from "../components/ui/theme-toggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "UI/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Cycles through light → dark → system on each click. Persists preference to localStorage. Shows sun, moon, or monitor icon."
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {};

export const WithClassName: Story = {
  args: { className: "border border-border bg-surface-1" }
};
