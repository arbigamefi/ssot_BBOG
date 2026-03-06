import type { Meta, StoryObj } from "@storybook/react";

import { GameCard } from "../components/ui/game-card";

const meta: Meta<typeof GameCard> = {
  title: "Navigation/GameCard",
  component: GameCard,
  parameters: {
    layout: "centered",
  },
  args: {
    slug: "dice",
    label: "Dice",
    icon: "🎲",
    description: "Set a cap, size your stake, and place a release-routed bet.",
  },
};

export default meta;

type Story = StoryObj<typeof GameCard>;

export const Default: Story = {
  args: {},
};

export const ReleaseSuite: Story = {
  render: () => (
    <div className="grid w-[960px] gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <GameCard
        slug="dice"
        label="Dice"
        icon="🎲"
        description="Cap-driven room with release-routed settlement."
      />
      <GameCard
        slug="coin-toss"
        label="Coin Toss"
        icon="🪙"
        description="Binary outcome room with the simplest parameter surface."
      />
      <GameCard
        slug="roulette"
        label="Roulette"
        icon="🎯"
        description="Legacy mask selection routed through the active manifest."
      />
      <GameCard
        slug="keno"
        label="Keno"
        icon="🔢"
        description="Packed number selection with the standard bet flow."
      />
    </div>
  ),
};
