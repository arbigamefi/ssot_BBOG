import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { StakeSpecForm, type StakeSpecFormValue } from "../components/protocol/stake-spec-form";

const meta: Meta<typeof StakeSpecForm> = {
  title: "Forms/StakeSpecForm",
  component: StakeSpecForm,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof StakeSpecForm>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = React.useState<StakeSpecFormValue>({
      amountPerRoll: "1",
      betCount: "1",
      stopGain: "",
      stopLoss: "",
    });

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Stake spec</CardTitle>
        </CardHeader>
        <CardContent>
          <StakeSpecForm value={value} onChange={setValue} unitHint="USDC (6)" />
          <pre className="mt-4 rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(value, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  },
};

export const WithErrors: Story = {
  render: () => {
    const [value, setValue] = React.useState<StakeSpecFormValue>({
      amountPerRoll: "",
      betCount: "0",
    });

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Stake spec (errors)</CardTitle>
        </CardHeader>
        <CardContent>
          <StakeSpecForm
            value={value}
            onChange={setValue}
            unitHint="USDC (6)"
            errors={{
              amountPerRoll: "Required",
              betCount: "Must be >= 1",
              stopGain: "Invalid",
              stopLoss: "Invalid",
            }}
            defaultShowAdvanced
          />
        </CardContent>
      </Card>
    );
  },
};
