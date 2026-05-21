import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../components/ui/button";
import {
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderBrand,
  ShellHeaderNav
} from "../components/ui/shell-header";

const meta: Meta<typeof ShellHeader> = {
  title: "UI/ShellHeader",
  component: ShellHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;
type Story = StoryObj<typeof ShellHeader>;

export const Solid: Story = {
  render: () => (
    <ShellHeader>
      <ShellHeaderBrand />
      <ShellHeaderNav>
        <a href="#">Casino</a>
        <a href="#">Sportsbook</a>
        <a href="#">Earn</a>
        <a href="#">Portfolio</a>
      </ShellHeaderNav>
      <ShellHeaderActions>
        <Button variant="secondary" size="sm">
          Base Sepolia
        </Button>
        <Button size="sm">Connect</Button>
      </ShellHeaderActions>
    </ShellHeader>
  )
};

export const Transparent: Story = {
  render: () => (
    <ShellHeader variant="transparent">
      <ShellHeaderBrand />
      <ShellHeaderActions>
        <Button variant="secondary" size="sm">
          Connect
        </Button>
      </ShellHeaderActions>
    </ShellHeader>
  )
};
