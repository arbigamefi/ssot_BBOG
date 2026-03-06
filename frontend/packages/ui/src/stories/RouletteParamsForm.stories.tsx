import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { RouletteParamsForm } from "../components/protocol/roulette-params-form";

const meta: Meta<typeof RouletteParamsForm> = {
  title: "Forms/RouletteParamsForm",
  component: RouletteParamsForm,
};

export default meta;
type Story = StoryObj<typeof RouletteParamsForm>;

export const Default: Story = {
  render: () => {
    const [mask, setMask] = React.useState<string>("0x12345");
    return <RouletteParamsForm mask={mask} onMaskChange={setMask} />;
  },
};

export const WithError: Story = {
  render: () => {
    const [mask, setMask] = React.useState<string>("0xzz");
    return <RouletteParamsForm mask={mask} onMaskChange={setMask} error="Invalid mask" />;
  },
};
