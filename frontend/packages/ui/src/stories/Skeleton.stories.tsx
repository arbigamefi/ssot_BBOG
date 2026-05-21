import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton, SkeletonCard, SkeletonMetric } from "../components/ui/skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Blocks: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <SkeletonMetric />
    </div>
  )
};

export const Card: Story = {
  render: () => (
    <div className="max-w-md rounded-lg border border-border bg-surface-1">
      <SkeletonCard lines={4} />
    </div>
  )
};
