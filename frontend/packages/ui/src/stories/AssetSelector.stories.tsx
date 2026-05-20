import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AssetSelector, type AssetOption } from "../components/protocol/asset-selector";

const meta: Meta<typeof AssetSelector> = {
  title: "Forms/AssetSelector",
  component: AssetSelector,
  parameters: {
    layout: "centered"
  }
};

export default meta;

type Story = StoryObj<typeof AssetSelector>;

const assets: AssetOption[] = [
  {
    address: "0x0000000000000000000000000000000000000001",
    symbol: "USDC",
    decimals: 6,
    label: "USDC"
  },
  {
    address: "0x0000000000000000000000000000000000000002",
    symbol: "WETH",
    decimals: 18,
    label: "WETH"
  }
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = React.useState<`0x${string}` | undefined>(assets[0]!.address);

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Select asset</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetSelector assets={assets} value={value} onValueChange={setValue} showAddress />
          <pre className="mt-4 rounded-md bg-surface-2 p-3 text-xs text-fg-muted">
            {JSON.stringify({ value }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }
};

export const WithErrors: Story = {
  render: () => {
    const [value, setValue] = React.useState<`0x${string}` | undefined>(undefined);

    return (
      <Card className="w-[440px]">
        <CardHeader>
          <CardTitle>Select asset (errors)</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetSelector
            assets={assets}
            value={value}
            onValueChange={setValue}
            error="Please select an asset"
            placeholder="Pick an asset"
          />
        </CardContent>
      </Card>
    );
  }
};
