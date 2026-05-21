import type { Meta, StoryObj } from "@storybook/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { Button } from "../components/ui/button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Bankroll status</CardTitle>
        <CardDescription>Live reserve and risk limits for the current market.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-fg-muted">Reserve</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-fg">25,000 USDC</dd>
          </div>
          <div>
            <dt className="text-fg-muted">House edge</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-accent">1.00%</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" size="sm">
          View details
        </Button>
      </CardFooter>
    </Card>
  )
};
