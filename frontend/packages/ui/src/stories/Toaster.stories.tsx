"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../components/ui/button";
import { toast, Toaster } from "../components/ui/toaster";

const meta: Meta<typeof Toaster> = {
  title: "UI/Toaster",
  component: Toaster,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Toaster>;

function ToastDemo() {
  React.useEffect(() => {
    toast.success("Bet settled", {
      description: "Payout was credited to your wallet."
    });
  }, []);

  return (
    <div className="min-h-64">
      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={() =>
            toast.success("Copied", {
              description: "The transaction hash is on your clipboard."
            })
          }
        >
          Success
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            toast.warning("Keeper delay", {
              description: "Settlement is taking longer than usual."
            })
          }
        >
          Warning
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            toast.error("Transaction failed", {
              description: "The wallet rejected the signature."
            })
          }
        >
          Error
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.loading("Waiting for VRF")}>
          Loading
        </Button>
      </div>
      <Toaster />
    </div>
  );
}

export const Default: Story = {
  render: () => <ToastDemo />
};
