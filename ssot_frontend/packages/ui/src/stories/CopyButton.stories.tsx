import type { Meta, StoryObj } from "@storybook/react";
import { CopyButton } from "../components/ui/copy-button";

const meta: Meta<typeof CopyButton> = {
  title: "UI/CopyButton",
  component: CopyButton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Small icon button that copies the provided value to the clipboard. Shows a checkmark for 1.5 s after a successful copy.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Address: Story = {
  args: { value: "0x1234567890abcdef1234567890abcdef12345678" },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 font-mono text-sm">
        <span>0x1234…5678</span>
        <Story />
      </div>
    ),
  ],
};

export const TxHash: Story = {
  args: { value: "0xdeadbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef1234", label: "Copy transaction hash" },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 font-mono text-sm">
        <span>0xdead…1234</span>
        <Story />
      </div>
    ),
  ],
};

export const BetId: Story = {
  args: { value: "42", label: "Copy bet ID" },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 font-mono text-sm">
        <span>Bet #42</span>
        <Story />
      </div>
    ),
  ],
};
