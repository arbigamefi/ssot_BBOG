import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  RouletteParamsForm,
  createDefaultRouletteSelection,
  type RouletteSelection,
} from "../components/protocol/roulette-params-form";

const meta: Meta<typeof RouletteParamsForm> = {
  title: "Forms/RouletteParamsForm",
  component: RouletteParamsForm,
};

export default meta;
type Story = StoryObj<typeof RouletteParamsForm>;

export const Default: Story = {
  render: () => {
    const [selection, setSelection] = React.useState<RouletteSelection>({ kind: "red" });
    return <RouletteParamsForm selection={selection} onChange={setSelection} />;
  },
};

export const WithError: Story = {
  render: () => {
    const [selection, setSelection] = React.useState<RouletteSelection>({ kind: "bitmask", mask: "0xzz" });
    return <RouletteParamsForm selection={selection} onChange={setSelection} error="Invalid mask" />;
  },
};

export const StraightTable: Story = {
  render: () => {
    const [selection, setSelection] = React.useState<RouletteSelection>(createDefaultRouletteSelection());
    return <RouletteParamsForm selection={selection} onChange={setSelection} />;
  },
};
