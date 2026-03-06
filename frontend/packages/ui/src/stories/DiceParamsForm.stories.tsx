import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DiceParamsForm } from "../components/protocol/dice-params-form";

const meta: Meta<typeof DiceParamsForm> = {
  title: "Forms/DiceParamsForm",
  component: DiceParamsForm,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof DiceParamsForm>;

export const Default: Story = {
  render: () => {
    const [cap, setCap] = React.useState("50");

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Dice params</CardTitle>
        </CardHeader>
        <CardContent>
          <DiceParamsForm cap={cap} onCapChange={setCap} />
          <pre className="mt-4 rounded-md bg-muted p-3 text-xs">{JSON.stringify({ cap }, null, 2)}</pre>
        </CardContent>
      </Card>
    );
  },
};

export const WithErrors: Story = {
  render: () => {
    const [cap, setCap] = React.useState("");

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Dice params (errors)</CardTitle>
        </CardHeader>
        <CardContent>
          <DiceParamsForm cap={cap} onCapChange={setCap} error="Cap is required" />
        </CardContent>
      </Card>
    );
  },
};
