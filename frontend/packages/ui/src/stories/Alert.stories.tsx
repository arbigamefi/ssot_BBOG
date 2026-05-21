import type { Meta, StoryObj } from "@storybook/react";

import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Variants: Story = {
  render: () => (
    <div className="grid max-w-xl gap-4">
      <Alert>
        <AlertTitle>Read-only mode</AlertTitle>
        <AlertDescription>Transactions are paused while release data is syncing.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Keeper delay</AlertTitle>
        <AlertDescription>Settlement is still safe, but taking longer than usual.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Transaction failed</AlertTitle>
        <AlertDescription>The wallet rejected the signature request.</AlertDescription>
      </Alert>
    </div>
  )
};
