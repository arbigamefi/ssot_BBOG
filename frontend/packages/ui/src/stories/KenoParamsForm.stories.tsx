import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { KenoParamsForm } from "../components/protocol/keno-params-form";

const meta: Meta<typeof KenoParamsForm> = {
  title: "Forms/KenoParamsForm",
  component: KenoParamsForm,
};

export default meta;
type Story = StoryObj<typeof KenoParamsForm>;

export const Default: Story = {
  render: () => {
    const [mask, setMask] = React.useState<string>("0xabcde");
    return <KenoParamsForm mask={mask} onMaskChange={setMask} />;
  },
};

export const WithError: Story = {
  render: () => {
    const [mask, setMask] = React.useState<string>("-1");
    return <KenoParamsForm mask={mask} onMaskChange={setMask} error="Mask out of range" />;
  },
};
