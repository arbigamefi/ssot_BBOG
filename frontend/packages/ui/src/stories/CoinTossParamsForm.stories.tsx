import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { CoinTossParamsForm, type CoinTossSide } from "../components/protocol/cointoss-params-form";

const meta: Meta<typeof CoinTossParamsForm> = {
  title: "Forms/CoinTossParamsForm",
  component: CoinTossParamsForm,
};

export default meta;
type Story = StoryObj<typeof CoinTossParamsForm>;

export const Default: Story = {
  render: () => {
    const [side, setSide] = React.useState<CoinTossSide>("heads");
    return <CoinTossParamsForm side={side} onSideChange={setSide} />;
  },
};

export const WithError: Story = {
  render: () => {
    const [side, setSide] = React.useState<CoinTossSide>("tails");
    return <CoinTossParamsForm side={side} onSideChange={setSide} error="Example error" />;
  },
};
